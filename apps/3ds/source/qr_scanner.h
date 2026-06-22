/**
 * qr_scanner.h — Camera + QR code scanning for 3DS
 *
 * Uses the 3DS cam service to capture frames and quirc to decode QR codes.
 * The QR code payload is a JSON string: {"url":"http://...","sid":"uuid"}
 *
 * Uses the outer camera at QVGA resolution and the bundled quirc decoder.
 */

#pragma once

#include <citro2d.h>

#define QR_URL_MAX 128
#define QR_SID_MAX 37

typedef struct {
    char url[QR_URL_MAX];
    char sid[QR_SID_MAX];
} QRResult;

typedef struct {
    unsigned int frames_captured;
    int qr_candidates;
    int average_luma;
    int consecutive_errors;
    int preview_ready;
    int error_stage;
    unsigned int last_result;
    int qr_grid_size;
    int decode_error;
    int payload_invalid;
    int consecutive_decode_failures;
    unsigned int auto_retries;
    int retry_notice_frames;
} QRScannerStatus;

/**
 * Initialize the camera for QR scanning.
 * @return 0 on success, -1 on error
 */
int qr_scanner_init(void);

/**
 * Cleanup camera resources.
 */
void qr_scanner_exit(void);

/**
 * Attempt to capture a frame and decode a QR code.
 * Captures one camera frame and returns 0 if no QR was found, 1 if decoded.
 *
 * @param result  Output QR result (filled on success)
 * @return 1 if QR decoded, 0 if still scanning, -1 on error
 */
int qr_scanner_update(QRResult* result);

/**
 * Return the latest camera frame as a Citro2D image.
 * The image remains owned by the scanner and is valid until qr_scanner_exit().
 */
int qr_scanner_get_preview(C2D_Image* image);

/**
 * Return lightweight diagnostics for the pairing UI.
 */
void qr_scanner_get_status(QRScannerStatus* status);

/**
 * Parse QR payload JSON: {"url":"...","sid":"..."}
 * Simple hand-rolled parser (no full JSON lib needed for this one field).
 *
 * @param json    Input JSON string
 * @param result  Output struct
 * @return 1 on success, 0 on parse failure
 */
int qr_parse_payload(const char* json, QRResult* result);
