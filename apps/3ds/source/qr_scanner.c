/**
 * qr_scanner.c — Camera + QR decoding for 3DS
 *
 * For the PoC, this provides:
 * 1. A hand-rolled JSON parser for the QR payload
 * 2. A stub camera implementation with manual input fallback
 *    (user types proxy URL and session ID via soft keyboard)
 *
 * Full quirc integration would replace the stub with real camera decoding.
 * TODO: Integrate quirc (https://github.com/dlbeer/quirc) for production
 */

#include "qr_scanner.h"
#include <string.h>
#include <stdio.h>
#include <3ds.h>

/* --------------------------------------------------------
   Simple JSON field extractor
   Finds "key":"value" in a JSON string — no full parser.
   -------------------------------------------------------- */

/**
 * Extract the string value for a given key from a JSON string.
 * Only handles flat string values (no nesting, no escaping).
 */
static int json_extract_string(
    const char* json,
    const char* key,
    char* out,
    size_t out_sz
) {
    /* Find "key" in json */
    char search_key[64];
    snprintf(search_key, sizeof(search_key), "\"%s\":", key);

    const char* pos = strstr(json, search_key);
    if (!pos) return 0;

    /* Skip past "key": */
    pos += strlen(search_key);

    /* Skip whitespace */
    while (*pos == ' ' || *pos == '\t') pos++;

    /* Expect opening quote */
    if (*pos != '"') return 0;
    pos++;

    /* Copy until closing quote */
    size_t i = 0;
    while (*pos && *pos != '"' && i < out_sz - 1) {
        out[i++] = *pos++;
    }
    out[i] = '\0';

    return (i > 0) ? 1 : 0;
}

int qr_parse_payload(const char* json, QRResult* result) {
    if (!json || !result) return 0;

    int got_url = json_extract_string(json, "url", result->url, QR_URL_MAX);
    int got_sid = json_extract_string(json, "sid", result->sid, QR_SID_MAX);

    return (got_url && got_sid) ? 1 : 0;
}

/* --------------------------------------------------------
   Camera stub — manual keyboard fallback for PoC
   In production: replace with quirc QR decoding pipeline
   -------------------------------------------------------- */

int qr_scanner_init(void) {
    /* TODO: Initialize cam service and allocate frame buffers
     * Result rc = camInit();
     * if (R_FAILED(rc)) return -1;
     * ... configure camera resolution, capture mode, etc.
     */
    return 0; /* Stub: always succeeds */
}

void qr_scanner_exit(void) {
    /* TODO: camExit(); */
}

int qr_scanner_update(QRResult* result) {
    /* TODO: Full implementation would:
     * 1. Grab camera frame: camReceiveImage(...)
     * 2. Pass to quirc: quirc_decode_line(...)
     * 3. If QR found: extract data and call qr_parse_payload()
     *
     * For PoC: return 0 (no QR yet) and let main.c
     * use the software keyboard fallback for manual URL+SID entry.
     */
    (void)result;
    return 0; /* 0 = no QR found yet */
}
