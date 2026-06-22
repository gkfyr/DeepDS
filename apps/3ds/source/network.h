/**
 * network.h — HTTP client wrappers for 3DS httpc service
 *
 * IMPORTANT: 3DS constraints:
 * - Plain HTTP is required for original-model 3DS compatibility
 * - The system SSL service only supports TLS 1.1; modern Vercel TLS cannot
 *   be reached directly
 * - No WebSockets
 * - Small response buffers (3DS has ~128MB RAM but httpc buffers are limited)
 * - Simple flat JSON responses only
 */

#pragma once

#include <stddef.h>

#define NET_BUF_SIZE  1024     /* Max response buffer */
#define NET_TIMEOUT   10000    /* 10 second timeout (ms) */

/**
 * Perform an HTTP GET request.
 * @param url     Full URL to fetch
 * @param buf     Output buffer for response body
 * @param buf_sz  Size of output buffer
 * @return HTTP status code, or -1 on error
 */
int http_get(const char* url, char* buf, size_t buf_sz);

/**
 * Perform an HTTP POST request with form-encoded body.
 * @param url     Full URL
 * @param body    Form body: "key=val&key2=val2" (URL-encoded)
 * @param buf     Output buffer for response body
 * @param buf_sz  Size of output buffer
 * @return HTTP status code, or -1 on error
 */
int http_post(const char* url, const char* body, char* buf, size_t buf_sz);

/**
 * Initialize the network (SOC service).
 * Call once at app startup.
 */
int network_init(void);

/**
 * Cleanup network resources.
 * Call at app exit.
 */
void network_exit(void);

/**
 * Last libctru Result produced by the HTTP layer, or 0 after a completed HTTP
 * response. Useful for displaying TLS/transport failures on-device.
 */
unsigned int network_last_result(void);
