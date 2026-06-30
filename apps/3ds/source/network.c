/**
 * network.c — HTTP/HTTPS client implementation for Nintendo 3DS
 *
 * Plain HTTP uses the 3DS httpc service. HTTPS uses mbedTLS over SOC sockets
 * because the system SSL service is limited to legacy TLS versions on original
 * hardware.
 *
 * Reference: https://libctru.devkitpro.org/httpc_8h.html
 */

#include "network.h"
#include "gts_wr1_cert.h"
#include <stdio.h>
#include <string.h>
#include <strings.h>
#include <stdlib.h>
#include <malloc.h>
#include <3ds.h>
#include <mbedtls/ctr_drbg.h>
#include <mbedtls/entropy.h>
#include <mbedtls/error.h>
#include <mbedtls/net_sockets.h>
#include <mbedtls/ssl.h>
#include <mbedtls/x509_crt.h>

/* SOC buffer — required for socket operations on 3DS */
#define SOC_BUFFER_SIZE  (1024 * 256)  /* 256 KB */
#define HTTPC_BUFFER_SIZE (1024 * 256)
#define HTTP_TIMEOUT_NS    15000000000ULL
#define URL_HOST_MAX       128
#define URL_PORT_MAX       6
#define URL_PATH_MAX       384
#define TLS_RESPONSE_MAX   8192

typedef struct {
    char host[URL_HOST_MAX];
    char port[URL_PORT_MAX];
    char path[URL_PATH_MAX];
    int is_https;
} ParsedUrl;

static u32* soc_buf = NULL;
static unsigned int s_last_result = 0;

static int network_fail(Result rc) {
    s_last_result = (unsigned int)rc;
    return -1;
}

unsigned int network_last_result(void) {
    return s_last_result;
}

static int network_fail_tls(int rc) {
    s_last_result = (unsigned int)(-rc);
    return -1;
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

static int parse_url(const char* url, ParsedUrl* parsed) {
    const char* cursor;
    const char* host_start;
    const char* host_end;
    const char* path_start;
    const char* port_start;
    size_t host_len;
    size_t port_len;
    size_t path_len;

    memset(parsed, 0, sizeof(*parsed));

    if (strncmp(url, "https://", 8) == 0) {
        parsed->is_https = 1;
        cursor = url + 8;
        strncpy(parsed->port, "443", sizeof(parsed->port) - 1);
    } else if (strncmp(url, "http://", 7) == 0) {
        parsed->is_https = 0;
        cursor = url + 7;
        strncpy(parsed->port, "80", sizeof(parsed->port) - 1);
    } else {
        return 0;
    }

    host_start = cursor;
    path_start = strchr(host_start, '/');
    host_end = path_start ? path_start : url + strlen(url);
    port_start = memchr(host_start, ':', (size_t)(host_end - host_start));
    if (port_start) {
        host_end = port_start;
        port_start++;
        port_len = (size_t)((path_start ? path_start : url + strlen(url)) - port_start);
        if (port_len == 0 || port_len >= sizeof(parsed->port)) return 0;
        memcpy(parsed->port, port_start, port_len);
        parsed->port[port_len] = '\0';
    }

    host_len = (size_t)(host_end - host_start);
    if (host_len == 0 || host_len >= sizeof(parsed->host)) return 0;
    memcpy(parsed->host, host_start, host_len);
    parsed->host[host_len] = '\0';

    if (path_start) {
        path_len = strlen(path_start);
        if (path_len >= sizeof(parsed->path)) return 0;
        memcpy(parsed->path, path_start, path_len + 1);
    } else {
        strncpy(parsed->path, "/", sizeof(parsed->path) - 1);
    }

    return 1;
}

static int find_header_end(const char* data, size_t len) {
    size_t i;
    for (i = 0; i + 3 < len; i++) {
        if (data[i] == '\r' && data[i + 1] == '\n' &&
            data[i + 2] == '\r' && data[i + 3] == '\n') {
            return (int)(i + 4);
        }
    }
    return -1;
}

static int has_chunked_encoding(const char* headers, size_t headers_len) {
    const char needle[] = "transfer-encoding:";
    const char chunked[] = "chunked";
    const char* end = headers + headers_len;
    const char* line = headers;

    while (line < end) {
        const char* next = memchr(line, '\n', (size_t)(end - line));
        size_t line_len = next ? (size_t)(next - line) : (size_t)(end - line);
        if (line_len >= sizeof(needle) - 1 &&
            strncasecmp(line, needle, sizeof(needle) - 1) == 0) {
            size_t i;
            for (i = sizeof(needle) - 1; i + sizeof(chunked) - 1 <= line_len; i++) {
                if (strncasecmp(line + i, chunked, sizeof(chunked) - 1) == 0) {
                    return 1;
                }
            }
        }
        if (!next) break;
        line = next + 1;
    }

    return 0;
}

static size_t copy_response_body(const char* body, size_t body_len, int chunked,
                                 char* out, size_t out_sz) {
    size_t written = 0;

    if (!chunked) {
        written = body_len < out_sz - 1 ? body_len : out_sz - 1;
        memcpy(out, body, written);
        out[written] = '\0';
        return written;
    }

    while (body_len > 0 && written < out_sz - 1) {
        char* endptr;
        unsigned long chunk_len = strtoul(body, &endptr, 16);
        size_t line_len;
        size_t copy_len;

        if (endptr == body || endptr + 1 >= body + body_len) break;
        if (endptr[0] != '\r' || endptr[1] != '\n') break;
        line_len = (size_t)(endptr + 2 - body);
        body += line_len;
        body_len -= line_len;

        if (chunk_len == 0) break;
        if (chunk_len > body_len) break;

        copy_len = chunk_len < out_sz - 1 - written ? chunk_len : out_sz - 1 - written;
        memcpy(out + written, body, copy_len);
        written += copy_len;

        body += chunk_len;
        body_len -= chunk_len;
        if (body_len >= 2 && body[0] == '\r' && body[1] == '\n') {
            body += 2;
            body_len -= 2;
        } else {
            break;
        }
    }

    out[written] = '\0';
    return written;
}

static int parse_raw_response(const char* raw, size_t raw_len, char* buf, size_t buf_sz) {
    int header_end = find_header_end(raw, raw_len);
    int status = 0;
    int chunked;

    if (header_end < 0) return -1;
    if (sscanf(raw, "HTTP/%*s %d", &status) != 1) return -1;

    chunked = has_chunked_encoding(raw, (size_t)header_end);
    copy_response_body(
        raw + header_end,
        raw_len - (size_t)header_end,
        chunked,
        buf,
        buf_sz
    );
    s_last_result = 0;
    return status;
}

static int tls_exchange(const ParsedUrl* url, const char* method, const char* body,
                        char* buf, size_t buf_sz) {
    mbedtls_net_context server_fd;
    mbedtls_entropy_context entropy;
    mbedtls_ctr_drbg_context ctr_drbg;
    mbedtls_ssl_context ssl;
    mbedtls_ssl_config conf;
    mbedtls_x509_crt cacert;
    char request[1024];
    char* raw;
    size_t raw_len = 0;
    int rc;
    int status = -1;
    const char pers[] = "deepds_tls";
    size_t body_len = body ? strlen(body) : 0;

    raw = (char*)malloc(TLS_RESPONSE_MAX);
    if (!raw) return -1;

    mbedtls_net_init(&server_fd);
    mbedtls_entropy_init(&entropy);
    mbedtls_ctr_drbg_init(&ctr_drbg);
    mbedtls_ssl_init(&ssl);
    mbedtls_ssl_config_init(&conf);
    mbedtls_x509_crt_init(&cacert);

    rc = mbedtls_ctr_drbg_seed(
        &ctr_drbg,
        mbedtls_entropy_func,
        &entropy,
        (const unsigned char*)pers,
        strlen(pers)
    );
    if (rc != 0) goto cleanup;

    rc = mbedtls_x509_crt_parse_der(&cacert, deepds_gts_wr1_der, deepds_gts_wr1_der_len);
    if (rc != 0) goto cleanup;

    rc = mbedtls_net_connect(&server_fd, url->host, url->port, MBEDTLS_NET_PROTO_TCP);
    if (rc != 0) goto cleanup;

    rc = mbedtls_ssl_config_defaults(
        &conf,
        MBEDTLS_SSL_IS_CLIENT,
        MBEDTLS_SSL_TRANSPORT_STREAM,
        MBEDTLS_SSL_PRESET_DEFAULT
    );
    if (rc != 0) goto cleanup;

    mbedtls_ssl_conf_authmode(&conf, MBEDTLS_SSL_VERIFY_OPTIONAL);
    mbedtls_ssl_conf_ca_chain(&conf, &cacert, NULL);
    mbedtls_ssl_conf_rng(&conf, mbedtls_ctr_drbg_random, &ctr_drbg);

    rc = mbedtls_ssl_setup(&ssl, &conf);
    if (rc != 0) goto cleanup;

    rc = mbedtls_ssl_set_hostname(&ssl, url->host);
    if (rc != 0) goto cleanup;

    mbedtls_ssl_set_bio(&ssl, &server_fd, mbedtls_net_send, mbedtls_net_recv, NULL);

    do {
        rc = mbedtls_ssl_handshake(&ssl);
    } while (rc == MBEDTLS_ERR_SSL_WANT_READ || rc == MBEDTLS_ERR_SSL_WANT_WRITE);
    if (rc != 0) goto cleanup;

    if (strcmp(method, "POST") == 0) {
        rc = snprintf(
            request,
            sizeof(request),
            "POST %s HTTP/1.1\r\n"
            "Host: %s\r\n"
            "User-Agent: DeepDS-3DS/0.3\r\n"
            "Accept: application/json\r\n"
            "Content-Type: application/x-www-form-urlencoded\r\n"
            "Content-Length: %lu\r\n"
            "Connection: close\r\n"
            "\r\n"
            "%s",
            url->path,
            url->host,
            (unsigned long)body_len,
            body ? body : ""
        );
    } else {
        rc = snprintf(
            request,
            sizeof(request),
            "GET %s HTTP/1.1\r\n"
            "Host: %s\r\n"
            "User-Agent: DeepDS-3DS/0.3\r\n"
            "Accept: application/json\r\n"
            "Connection: close\r\n"
            "\r\n",
            url->path,
            url->host
        );
    }
    if (rc < 0 || (size_t)rc >= sizeof(request)) {
        rc = -1;
        goto cleanup;
    }

    {
        size_t sent = 0;
        size_t request_len = strlen(request);
        while (sent < request_len) {
            rc = mbedtls_ssl_write(
                &ssl,
                (const unsigned char*)request + sent,
                request_len - sent
            );
            if (rc == MBEDTLS_ERR_SSL_WANT_READ || rc == MBEDTLS_ERR_SSL_WANT_WRITE) continue;
            if (rc <= 0) goto cleanup;
            sent += (size_t)rc;
        }
    }

    while (raw_len < TLS_RESPONSE_MAX - 1) {
        rc = mbedtls_ssl_read(
            &ssl,
            (unsigned char*)raw + raw_len,
            TLS_RESPONSE_MAX - 1 - raw_len
        );
        if (rc == MBEDTLS_ERR_SSL_WANT_READ || rc == MBEDTLS_ERR_SSL_WANT_WRITE) continue;
        if (rc == MBEDTLS_ERR_SSL_PEER_CLOSE_NOTIFY || rc == 0) break;
        if (rc < 0) goto cleanup;
        raw_len += (size_t)rc;
    }
    raw[raw_len] = '\0';

    status = parse_raw_response(raw, raw_len, buf, buf_sz);
    if (status < 0) {
        rc = -1;
        goto cleanup;
    }
    rc = 0;

cleanup:
    mbedtls_ssl_close_notify(&ssl);
    mbedtls_net_free(&server_fd);
    mbedtls_x509_crt_free(&cacert);
    mbedtls_ssl_free(&ssl);
    mbedtls_ssl_config_free(&conf);
    mbedtls_ctr_drbg_free(&ctr_drbg);
    mbedtls_entropy_free(&entropy);
    free(raw);

    if (rc != 0) return network_fail_tls(rc);
    return status;
}

int http_get(const char* url, char* buf, size_t buf_sz) {
    if (!url || !buf || buf_sz == 0) return -1;

    if (strncmp(url, "https://", 8) == 0) {
        ParsedUrl parsed;
        if (!parse_url(url, &parsed)) return -1;
        return tls_exchange(&parsed, "GET", NULL, buf, buf_sz);
    }

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

    if (strncmp(url, "https://", 8) == 0) {
        ParsedUrl parsed;
        if (!parse_url(url, &parsed)) return -1;
        return tls_exchange(&parsed, "POST", body, buf, buf_sz);
    }

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
