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

/* SOC buffer — required for socket operations on 3DS */
#define SOC_BUFFER_SIZE  (1024 * 256)  /* 256 KB */
static u32* soc_buf = NULL;

/**
 * Koyeb and other public hosts expose HTTPS-only endpoints.
 *
 * The 3DS root CA store is old, so certificate verification is disabled for
 * this hackathon PoC. Traffic is still encrypted, but this is not suitable for
 * a production custody service.
 */
static Result configure_context(httpcContext* ctx, const char* url) {
    Result rc = httpcAddRequestHeaderField(
        ctx,
        "User-Agent",
        "DeepDS-3DS/0.2"
    );
    if (R_FAILED(rc)) return rc;

    rc = httpcSetKeepAlive(ctx, HTTPC_KEEPALIVE_ENABLED);
    if (R_FAILED(rc)) return rc;

    if (strncmp(url, "https://", 8) == 0) {
        rc = httpcSetSSLOpt(ctx, SSLCOPT_DisableVerify);
        if (R_FAILED(rc)) return rc;
    }

    return 0;
}

int network_init(void) {
    soc_buf = (u32*)memalign(0x1000, SOC_BUFFER_SIZE);
    if (!soc_buf) return -1;

    Result rc = socInit(soc_buf, SOC_BUFFER_SIZE);
    if (R_FAILED(rc)) {
        free(soc_buf);
        soc_buf = NULL;
        return -1;
    }

    /* Initialize httpc service */
    rc = httpcInit(0);
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
    Result rc = httpcGetResponseStatusCode(ctx, &status);
    if (R_FAILED(rc)) return -1;

    /* Read body */
    u32 offset = 0;
    u32 chunk;
    while (1) {
        if (offset >= buf_sz - 1) break;
        chunk = (u32)(buf_sz - 1 - offset);
        rc = httpcDownloadData(ctx, (u8*)(buf + offset), chunk, &chunk);
        offset += chunk;
        if (rc == HTTPC_RESULTCODE_DOWNLOADPENDING) continue;
        break;
    }
    buf[offset] = '\0';
    return (int)status;
}

int http_get(const char* url, char* buf, size_t buf_sz) {
    if (!url || !buf || buf_sz == 0) return -1;

    httpcContext ctx;
    Result rc = httpcOpenContext(&ctx, HTTPC_METHOD_GET, url, 0);
    if (R_FAILED(rc)) return -1;

    rc = configure_context(&ctx, url);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return -1;
    }

    rc = httpcBeginRequest(&ctx);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return -1;
    }

    int status = read_response(&ctx, buf, buf_sz);
    httpcCloseContext(&ctx);
    return status;
}

int http_post(const char* url, const char* body, char* buf, size_t buf_sz) {
    if (!url || !buf || buf_sz == 0) return -1;

    httpcContext ctx;
    Result rc = httpcOpenContext(&ctx, HTTPC_METHOD_POST, url, 0);
    if (R_FAILED(rc)) return -1;

    rc = configure_context(&ctx, url);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return -1;
    }

    rc = httpcAddRequestHeaderField(
        &ctx,
        "Content-Type",
        "application/x-www-form-urlencoded"
    );
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return -1;
    }

    if (body && strlen(body) > 0) {
        rc = httpcAddPostDataRaw(
            &ctx,
            (const u32*)body,
            (u32)strlen(body)
        );
        if (R_FAILED(rc)) {
            httpcCloseContext(&ctx);
            return -1;
        }
    }

    rc = httpcBeginRequest(&ctx);
    if (R_FAILED(rc)) {
        httpcCloseContext(&ctx);
        return -1;
    }

    int status = read_response(&ctx, buf, buf_sz);
    httpcCloseContext(&ctx);
    return status;
}
