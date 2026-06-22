/**
 * network.c — HTTP client implementation using 3DS httpc service
 *
 * The 3DS httpc service provides basic HTTP/1.1 functionality.
 * We use it for plain HTTP requests to the proxy server.
 *
 * Reference: https://libctru.devkitpro.org/httpc_8h.html
 */

#include "network.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <malloc.h>
#include <3ds.h>
#include "gts_wr1_cert.h"

/* SOC buffer — required for socket operations on 3DS */
#define SOC_BUFFER_SIZE  (1024 * 256)  /* 256 KB */
#define HTTPC_BUFFER_SIZE (1024 * 256)
#define HTTP_TIMEOUT_NS    15000000000ULL
static u32* soc_buf = NULL;
static unsigned int s_last_result = 0;

static int network_fail(Result rc) {
    s_last_result = (unsigned int)rc;
    return -1;
}

unsigned int network_last_result(void) {
    return s_last_result;
}

/**
 * Koyeb and other public hosts expose HTTPS-only endpoints.
 *
 * The 3DS root CA store is old, so certificate verification is disabled for
 * this hackathon PoC. Traffic is still encrypted, but this is not suitable for
 * a production custody service.
 */
static Result configure_context(httpcContext* ctx, const char* url) {
    Result rc;

    /*
     * SSL options must be configured immediately after httpcOpenContext().
     * On real hardware, setting DisableVerify after other context mutations
     * can leave the option unapplied and httpcBeginRequest() then fails with
     * 0xD8A0A03C (server certificate verification failed).
     */
    if (strncmp(url, "https://", 8) == 0) {
        /*
         * The stock 3DS CA store predates Google Trust Services, which signs
         * Vercel's current certificates. Trust the WR1 intermediate shipped
         * with the app so real hardware can validate *.vercel.app.
         */
        rc = httpcAddTrustedRootCA(
            ctx,
            deepds_gts_wr1_der,
            deepds_gts_wr1_der_len
        );
        if (R_FAILED(rc)) return rc;

        /* Keep this as a fallback for old HTTP service implementations. */
        rc = httpcSetSSLOpt(ctx, SSLCOPT_DisableVerify);
        if (R_FAILED(rc)) return rc;
    }

    rc = httpcAddRequestHeaderField(
        ctx,
        "User-Agent",
        "DeepDS-3DS/0.2"
    );
    if (R_FAILED(rc)) return rc;

    rc = httpcSetKeepAlive(ctx, HTTPC_KEEPALIVE_DISABLED);
    if (R_FAILED(rc)) return rc;

    rc = httpcAddRequestHeaderField(ctx, "Accept", "application/json");
    if (R_FAILED(rc)) return rc;

    rc = httpcAddRequestHeaderField(ctx, "Connection", "close");
    if (R_FAILED(rc)) return rc;

    return 0;
}

int network_init(void) {
    s_last_result = 0;
    soc_buf = (u32*)memalign(0x1000, SOC_BUFFER_SIZE);
    if (!soc_buf) return -1;

    Result rc = socInit(soc_buf, SOC_BUFFER_SIZE);
    if (R_FAILED(rc)) {
        free(soc_buf);
        soc_buf = NULL;
        return -1;
    }

    /* Initialize httpc service */
    /* POST/PUT requests require upload shared memory. */
    rc = httpcInit(HTTPC_BUFFER_SIZE);
    if (R_FAILED(rc)) {
        socExit();
        free(soc_buf);
        soc_buf = NULL;
        return -1;
    }

    return 0;
}

void network_exit(void) {
    httpcExit();
    socExit();
    if (soc_buf) {
        free(soc_buf);
        soc_buf = NULL;
    }
}

/**
 * Internal helper: read full HTTP response body.
 */
static int read_response(httpcContext* ctx, char* buf, size_t buf_sz) {
    u32 status = 0;
    Result rc = httpcGetResponseStatusCodeTimeout(
        ctx,
        &status,
        HTTP_TIMEOUT_NS
    );
    if (R_FAILED(rc)) return network_fail(rc);

    /* Read body */
    u32 offset = 0;
    u32 chunk;
    while (1) {
        if (offset >= buf_sz - 1) break;
        chunk = (u32)(buf_sz - 1 - offset);
        rc = httpcDownloadData(ctx, (u8*)(buf + offset), chunk, &chunk);
        offset += chunk;
        if (rc == HTTPC_RESULTCODE_DOWNLOADPENDING) continue;
        if (R_FAILED(rc)) {
            buf[offset] = '\0';
            return network_fail(rc);
        }
        break;
    }
    buf[offset] = '\0';
    s_last_result = 0;
    return (int)status;
}

int http_get(const char* url, char* buf, size_t buf_sz) {
    if (!url || !buf || buf_sz == 0) return -1;

    httpcContext ctx;
    Result rc = httpcOpenContext(&ctx, HTTPC_METHOD_GET, url, 0);
    if (R_FAILED(rc)) return network_fail(rc);

    rc = configure_context(&ctx, url);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return network_fail(rc);
    }

    rc = httpcBeginRequest(&ctx);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return network_fail(rc);
    }

    int status = read_response(&ctx, buf, buf_sz);
    httpcCloseContext(&ctx);
    return status;
}

int http_post(const char* url, const char* body, char* buf, size_t buf_sz) {
    if (!url || !buf || buf_sz == 0) return -1;

    httpcContext ctx;
    Result rc = httpcOpenContext(&ctx, HTTPC_METHOD_POST, url, 0);
    if (R_FAILED(rc)) return network_fail(rc);

    rc = configure_context(&ctx, url);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return network_fail(rc);
    }

    rc = httpcAddRequestHeaderField(
        &ctx,
        "Content-Type",
        "application/x-www-form-urlencoded"
    );
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return network_fail(rc);
    }

    if (body && strlen(body) > 0) {
        rc = httpcAddPostDataRaw(
            &ctx,
            (const u32*)body,
            (u32)strlen(body)
        );
        if (R_FAILED(rc)) {
            httpcCloseContext(&ctx);
            return network_fail(rc);
        }
    }

    rc = httpcBeginRequest(&ctx);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return network_fail(rc);
    }

    int status = read_response(&ctx, buf, buf_sz);
    httpcCloseContext(&ctx);
    return status;
}
