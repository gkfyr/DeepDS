/**
 * qr_scanner.c — Camera + QR decoding for 3DS
 *
 * Captures QVGA RGB565 frames from the outer camera, converts them to
 * grayscale, and decodes the web pairing payload with quirc.
 */

#include "qr_scanner.h"
#include "quirc.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <3ds.h>

#define QR_FRAME_WIDTH       320
#define QR_FRAME_HEIGHT      240
#define QR_FRAME_PIXELS      (QR_FRAME_WIDTH * QR_FRAME_HEIGHT)
#define QR_FRAME_BYTES       (QR_FRAME_PIXELS * sizeof(u16))
#define QR_CAPTURE_TIMEOUT   180000000ULL

static u16* s_camera_frame = NULL;
static struct quirc* s_decoder = NULL;
static struct quirc_code s_code;
static struct quirc_data s_data;
static u32 s_transfer_unit = 0;
static int s_cam_initialized = 0;
static int s_camera_activated = 0;
static int s_capture_started = 0;
static int s_camera_ready = 0;

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

static int camera_call_ok(Result rc) {
    return R_SUCCEEDED(rc);
}

static void rgb565_to_grayscale(const u16* source, u8* destination) {
    for (int i = 0; i < QR_FRAME_PIXELS; i++) {
        u16 pixel = source[i];
        u8 red = (u8)((pixel & 0x1f) << 3);
        u8 green = (u8)(((pixel >> 5) & 0x3f) << 2);
        u8 blue = (u8)(((pixel >> 11) & 0x1f) << 3);

        destination[i] = (u8)(
            ((u32)red * 77 + (u32)green * 150 + (u32)blue * 29) >> 8
        );
    }
}

int qr_scanner_init(void) {
    if (s_camera_ready) return 0;

    s_decoder = quirc_new();
    if (!s_decoder || quirc_resize(s_decoder, QR_FRAME_WIDTH, QR_FRAME_HEIGHT) < 0) {
        qr_scanner_exit();
        return -1;
    }

    s_camera_frame = (u16*)linearAlloc(QR_FRAME_BYTES);
    if (!s_camera_frame) {
        qr_scanner_exit();
        return -1;
    }

    if (!camera_call_ok(camInit())) {
        qr_scanner_exit();
        return -1;
    }
    s_cam_initialized = 1;

    if (!camera_call_ok(CAMU_SetSize(SELECT_OUT1, SIZE_QVGA, CONTEXT_A)) ||
        !camera_call_ok(CAMU_SetOutputFormat(SELECT_OUT1, OUTPUT_RGB_565, CONTEXT_A)) ||
        !camera_call_ok(CAMU_SetFrameRate(SELECT_OUT1, FRAME_RATE_10)) ||
        !camera_call_ok(CAMU_SetNoiseFilter(SELECT_OUT1, true)) ||
        !camera_call_ok(CAMU_SetAutoExposure(SELECT_OUT1, true)) ||
        !camera_call_ok(CAMU_SetAutoWhiteBalance(SELECT_OUT1, true)) ||
        !camera_call_ok(CAMU_SetTrimming(PORT_CAM1, false)) ||
        !camera_call_ok(CAMU_GetMaxBytes(
            &s_transfer_unit,
            QR_FRAME_WIDTH,
            QR_FRAME_HEIGHT
        )) ||
        !camera_call_ok(CAMU_SetTransferBytes(
            PORT_CAM1,
            s_transfer_unit,
            QR_FRAME_WIDTH,
            QR_FRAME_HEIGHT
        ))) {
        qr_scanner_exit();
        return -1;
    }

    if (!camera_call_ok(CAMU_Activate(SELECT_OUT1))) {
        qr_scanner_exit();
        return -1;
    }
    s_camera_activated = 1;

    if (!camera_call_ok(CAMU_ClearBuffer(PORT_CAM1)) ||
        !camera_call_ok(CAMU_StartCapture(PORT_CAM1))) {
        qr_scanner_exit();
        return -1;
    }
    s_capture_started = 1;
    s_camera_ready = 1;
    return 0;
}

void qr_scanner_exit(void) {
    s_camera_ready = 0;

    if (s_capture_started) {
        CAMU_StopCapture(PORT_CAM1);
        s_capture_started = 0;
    }
    if (s_camera_activated) {
        CAMU_Activate(SELECT_NONE);
        s_camera_activated = 0;
    }
    if (s_cam_initialized) {
        camExit();
        s_cam_initialized = 0;
    }

    if (s_camera_frame) {
        linearFree(s_camera_frame);
        s_camera_frame = NULL;
    }

    if (s_decoder) {
        quirc_destroy(s_decoder);
        s_decoder = NULL;
    }

    s_transfer_unit = 0;
}

int qr_scanner_update(QRResult* result) {
    if (!result || !s_camera_ready || !s_camera_frame || !s_decoder) {
        return -1;
    }

    Handle receive_event = 0;
    Result rc = CAMU_SetReceiving(
        &receive_event,
        s_camera_frame,
        PORT_CAM1,
        QR_FRAME_BYTES,
        (s16)s_transfer_unit
    );
    if (R_FAILED(rc)) return -1;

    rc = svcWaitSynchronization(receive_event, QR_CAPTURE_TIMEOUT);
    svcCloseHandle(receive_event);
    if (R_FAILED(rc)) {
        /* A missed frame is recoverable; keep scanning on the next update. */
        return 0;
    }

    int width = 0;
    int height = 0;
    u8* image = quirc_begin(s_decoder, &width, &height);
    if (!image || width != QR_FRAME_WIDTH || height != QR_FRAME_HEIGHT) {
        return -1;
    }

    rgb565_to_grayscale(s_camera_frame, image);
    quirc_end(s_decoder);

    int count = quirc_count(s_decoder);
    for (int i = 0; i < count; i++) {
        quirc_extract(s_decoder, i, &s_code);

        quirc_decode_error_t decode_result = quirc_decode(&s_code, &s_data);
        if (decode_result == QUIRC_ERROR_DATA_ECC) {
            quirc_flip(&s_code);
            decode_result = quirc_decode(&s_code, &s_data);
        }
        if (decode_result != QUIRC_SUCCESS || s_data.payload_len <= 0) {
            continue;
        }

        size_t payload_len = (size_t)s_data.payload_len;
        if (payload_len >= QUIRC_MAX_PAYLOAD) {
            payload_len = QUIRC_MAX_PAYLOAD - 1;
        }
        s_data.payload[payload_len] = '\0';

        if (qr_parse_payload((const char*)s_data.payload, result)) {
            return 1;
        }
    }

    return 0;
}
