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
#include <malloc.h>
#include <3ds.h>

#define QR_FRAME_WIDTH       320
#define QR_FRAME_HEIGHT      240
#define QR_FRAME_PIXELS      (QR_FRAME_WIDTH * QR_FRAME_HEIGHT)
#define QR_FRAME_BYTES       (QR_FRAME_PIXELS * sizeof(u16))
#define QR_CAPTURE_TIMEOUT   1000000000ULL
#define PREVIEW_TEX_WIDTH    512
#define PREVIEW_TEX_HEIGHT   256
#define CAMERA_ERROR_LIMIT   3

static u16* s_camera_frame = NULL;
static struct quirc* s_decoder = NULL;
static struct quirc_code s_code;
static struct quirc_data s_data;
static u32 s_transfer_unit = 0;
static int s_cam_initialized = 0;
static int s_camera_activated = 0;
static int s_capture_started = 0;
static int s_camera_ready = 0;
static C3D_Tex s_preview_texture;
static Tex3DS_SubTexture s_preview_subtexture;
static C2D_Image s_preview_image;
static int s_preview_initialized = 0;
static QRScannerStatus s_status;

enum {
    QR_CAM_STAGE_NONE = 0,
    QR_CAM_STAGE_DECODER = 1,
    QR_CAM_STAGE_FRAME_BUFFER = 2,
    QR_CAM_STAGE_TEXTURE = 3,
    QR_CAM_STAGE_SERVICE = 4,
    QR_CAM_STAGE_CONFIG = 5,
    QR_CAM_STAGE_ACTIVATE = 6,
    QR_CAM_STAGE_CAPTURE = 7,
    QR_CAM_STAGE_RECEIVE = 8,
    QR_CAM_STAGE_WAIT = 9,
    QR_CAM_STAGE_RESTART = 10,
};

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

static int scanner_fail(int stage, Result rc) {
    s_status.error_stage = stage;
    s_status.last_result = (unsigned int)rc;
    return -1;
}

/* PICA textures use 8x8 Morton-order tiles. */
static const u8 s_morton_lut[64] = {
     0,  1,  4,  5, 16, 17, 20, 21,
     2,  3,  6,  7, 18, 19, 22, 23,
     8,  9, 12, 13, 24, 25, 28, 29,
    10, 11, 14, 15, 26, 27, 30, 31,
    32, 33, 36, 37, 48, 49, 52, 53,
    34, 35, 38, 39, 50, 51, 54, 55,
    40, 41, 44, 45, 56, 57, 60, 61,
    42, 43, 46, 47, 58, 59, 62, 63
};

static size_t texture_pixel_offset(int x, int y) {
    int tile_x = x >> 3;
    int tile_y = y >> 3;
    int tiles_per_row = PREVIEW_TEX_WIDTH >> 3;
    int tile_offset = (tile_y * tiles_per_row + tile_x) * 64;
    int local = (y & 7) * 8 + (x & 7);
    return (size_t)(tile_offset + s_morton_lut[local]);
}

static u16 camera_rgb565_to_gpu(u16 pixel) {
    /* CAM RGB565 stores red in the low bits; GPU_RGB565 expects red high. */
    return (u16)(
        (pixel & 0x07e0) |
        ((pixel & 0x001f) << 11) |
        ((pixel & 0xf800) >> 11)
    );
}

static int rgb565_to_grayscale_and_preview(
    const u16* source,
    u8* destination
) {
    u16* preview = (u16*)s_preview_texture.data;
    unsigned long luma_sum = 0;

    for (int y = 0; y < QR_FRAME_HEIGHT; y++) {
        /*
         * CAM frames are bottom-up. Flip rows here so both the preview and
         * quirc see the same upright camera image.
         */
        int source_y = QR_FRAME_HEIGHT - 1 - y;
        for (int x = 0; x < QR_FRAME_WIDTH; x++) {
            u16 pixel = source[source_y * QR_FRAME_WIDTH + x];
            u8 red = (u8)((pixel & 0x1f) << 3);
            u8 green = (u8)(((pixel >> 5) & 0x3f) << 2);
            u8 blue = (u8)(((pixel >> 11) & 0x1f) << 3);
            u8 luma = (u8)(
                ((u32)red * 77 + (u32)green * 150 + (u32)blue * 29) >> 8
            );

            destination[y * QR_FRAME_WIDTH + x] = luma;
            preview[texture_pixel_offset(x, y)] =
                camera_rgb565_to_gpu(pixel);
            luma_sum += luma;
        }
    }

    C3D_TexFlush(&s_preview_texture);
    return (int)(luma_sum / QR_FRAME_PIXELS);
}

static int restart_capture(void) {
    if (!s_cam_initialized || !s_camera_activated) {
        return scanner_fail(QR_CAM_STAGE_RESTART, (Result)-1);
    }

    if (s_capture_started) {
        CAMU_StopCapture(PORT_CAM1);
        s_capture_started = 0;
    }
    Result rc = CAMU_ClearBuffer(PORT_CAM1);
    if (R_FAILED(rc)) return scanner_fail(QR_CAM_STAGE_RESTART, rc);
    rc = CAMU_StartCapture(PORT_CAM1);
    if (R_FAILED(rc)) return scanner_fail(QR_CAM_STAGE_RESTART, rc);
    s_capture_started = 1;
    s_status.consecutive_errors = 0;
    s_status.error_stage = QR_CAM_STAGE_NONE;
    s_status.last_result = 0;
    return 0;
}

int qr_scanner_init(void) {
    if (s_camera_ready) return 0;
    memset(&s_status, 0, sizeof(s_status));

    s_decoder = quirc_new();
    if (!s_decoder || quirc_resize(s_decoder, QR_FRAME_WIDTH, QR_FRAME_HEIGHT) < 0) {
        scanner_fail(QR_CAM_STAGE_DECODER, (Result)-1);
        goto fail;
    }

    /*
     * Match libctru's camera examples: CAMU writes into a page-aligned
     * application heap buffer. This is more broadly compatible than linearAlloc
     * for camera-service DMA on older hardware revisions.
     */
    s_camera_frame = (u16*)memalign(0x1000, QR_FRAME_BYTES);
    if (!s_camera_frame) {
        scanner_fail(QR_CAM_STAGE_FRAME_BUFFER, (Result)-1);
        goto fail;
    }

    if (!C3D_TexInit(
        &s_preview_texture,
        PREVIEW_TEX_WIDTH,
        PREVIEW_TEX_HEIGHT,
        GPU_RGB565
    )) {
        scanner_fail(QR_CAM_STAGE_TEXTURE, (Result)-1);
        goto fail;
    }
    s_preview_initialized = 1;
    memset(
        s_preview_texture.data,
        0,
        PREVIEW_TEX_WIDTH * PREVIEW_TEX_HEIGHT * sizeof(u16)
    );
    C3D_TexSetFilter(&s_preview_texture, GPU_LINEAR, GPU_LINEAR);
    C3D_TexSetWrap(
        &s_preview_texture,
        GPU_CLAMP_TO_EDGE,
        GPU_CLAMP_TO_EDGE
    );

    s_preview_subtexture.width = QR_FRAME_WIDTH;
    s_preview_subtexture.height = QR_FRAME_HEIGHT;
    s_preview_subtexture.left = 0.0f;
    s_preview_subtexture.top = 1.0f;
    s_preview_subtexture.right =
        (float)QR_FRAME_WIDTH / PREVIEW_TEX_WIDTH;
    s_preview_subtexture.bottom =
        1.0f - ((float)QR_FRAME_HEIGHT / PREVIEW_TEX_HEIGHT);
    s_preview_image.tex = &s_preview_texture;
    s_preview_image.subtex = &s_preview_subtexture;

    Result rc = camInit();
    if (!camera_call_ok(rc)) {
        scanner_fail(QR_CAM_STAGE_SERVICE, rc);
        goto fail;
    }
    s_cam_initialized = 1;

    /*
     * The official libctru examples configure both outer sensors together,
     * even when only CAM1 is received. Some hardware revisions reject a
     * partial outer-camera configuration.
     */
#define CAM_CONFIG(call) \
    do { \
        rc = (call); \
        if (R_FAILED(rc)) { \
            scanner_fail(QR_CAM_STAGE_CONFIG, rc); \
            goto fail; \
        } \
    } while (0)

    CAM_CONFIG(CAMU_SetSize(
        SELECT_OUT1_OUT2,
        SIZE_QVGA,
        CONTEXT_A
    ));
    CAM_CONFIG(CAMU_SetOutputFormat(
        SELECT_OUT1_OUT2,
        OUTPUT_RGB_565,
        CONTEXT_A
    ));
    CAM_CONFIG(CAMU_SetFrameRate(SELECT_OUT1_OUT2, FRAME_RATE_10));
    CAM_CONFIG(CAMU_SetNoiseFilter(SELECT_OUT1_OUT2, true));
    CAM_CONFIG(CAMU_SetAutoExposure(SELECT_OUT1_OUT2, true));
    CAM_CONFIG(CAMU_SetAutoWhiteBalance(SELECT_OUT1_OUT2, true));
    CAM_CONFIG(CAMU_SetTrimming(PORT_CAM1, false));
    CAM_CONFIG(CAMU_GetMaxBytes(
        &s_transfer_unit,
        QR_FRAME_WIDTH,
        QR_FRAME_HEIGHT
    ));
    CAM_CONFIG(CAMU_SetTransferBytes(
        PORT_CAM1,
        s_transfer_unit,
        QR_FRAME_WIDTH,
        QR_FRAME_HEIGHT
    ));
#undef CAM_CONFIG

    rc = CAMU_Activate(SELECT_OUT1);
    if (!camera_call_ok(rc)) {
        scanner_fail(QR_CAM_STAGE_ACTIVATE, rc);
        goto fail;
    }
    s_camera_activated = 1;

    rc = CAMU_ClearBuffer(PORT_CAM1);
    if (!camera_call_ok(rc)) {
        scanner_fail(QR_CAM_STAGE_CAPTURE, rc);
        goto fail;
    }
    rc = CAMU_StartCapture(PORT_CAM1);
    if (!camera_call_ok(rc)) {
        scanner_fail(QR_CAM_STAGE_CAPTURE, rc);
        goto fail;
    }
    s_capture_started = 1;
    s_camera_ready = 1;
    s_status.error_stage = QR_CAM_STAGE_NONE;
    s_status.last_result = 0;
    return 0;

fail:
    {
        int error_stage = s_status.error_stage;
        unsigned int last_result = s_status.last_result;
        qr_scanner_exit();
        s_status.error_stage = error_stage;
        s_status.last_result = last_result;
    }
    return -1;
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
        free(s_camera_frame);
        s_camera_frame = NULL;
    }

    if (s_decoder) {
        quirc_destroy(s_decoder);
        s_decoder = NULL;
    }
    if (s_preview_initialized) {
        C3D_TexDelete(&s_preview_texture);
        memset(&s_preview_texture, 0, sizeof(s_preview_texture));
        s_preview_initialized = 0;
    }

    s_transfer_unit = 0;
    s_status.preview_ready = 0;
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
    if (R_FAILED(rc)) {
        s_status.error_stage = QR_CAM_STAGE_RECEIVE;
        s_status.last_result = (unsigned int)rc;
        s_status.consecutive_errors++;
        return restart_capture();
    }

    rc = svcWaitSynchronization(receive_event, QR_CAPTURE_TIMEOUT);
    svcCloseHandle(receive_event);
    if (R_FAILED(rc)) {
        s_status.error_stage = QR_CAM_STAGE_WAIT;
        s_status.last_result = (unsigned int)rc;
        s_status.consecutive_errors++;
        return restart_capture();
    }
    s_status.consecutive_errors = 0;
    s_status.error_stage = QR_CAM_STAGE_NONE;
    s_status.last_result = 0;
    s_status.frames_captured++;

    int width = 0;
    int height = 0;
    u8* image = quirc_begin(s_decoder, &width, &height);
    if (!image || width != QR_FRAME_WIDTH || height != QR_FRAME_HEIGHT) {
        return -1;
    }

    s_status.average_luma =
        rgb565_to_grayscale_and_preview(s_camera_frame, image);
    s_status.preview_ready = 1;
    quirc_end(s_decoder);

    int count = quirc_count(s_decoder);
    s_status.qr_candidates = count;
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

int qr_scanner_get_preview(C2D_Image* image) {
    if (!image || !s_preview_initialized || !s_status.preview_ready) return 0;
    *image = s_preview_image;
    return 1;
}

void qr_scanner_get_status(QRScannerStatus* status) {
    if (!status) return;
    *status = s_status;
}
