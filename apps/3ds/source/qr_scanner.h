/**
 * qr_scanner.h — Camera + QR code scanning for 3DS
 *
 * Uses the 3DS cam service to capture frames and quirc to decode QR codes.
 * The QR code payload is a JSON string: {"url":"http://...","sid":"uuid"}
 *
 * TODO: Integrate quirc library (https://github.com/dlbeer/quirc)
 * For PoC, we provide the interface and a manual input fallback.
 */

#pragma once

#define QR_URL_MAX 128
#define QR_SID_MAX 37

typedef struct {
    char url[QR_URL_MAX];
    char sid[QR_SID_MAX];
} QRResult;

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
 * Non-blocking — returns 0 if no QR found yet, 1 if decoded.
 *
 * @param result  Output QR result (filled on success)
 * @return 1 if QR decoded, 0 if still scanning, -1 on error
 */
int qr_scanner_update(QRResult* result);

/**
 * Parse QR payload JSON: {"url":"...","sid":"..."}
 * Simple hand-rolled parser (no full JSON lib needed for this one field).
 *
 * @param json    Input JSON string
 * @param result  Output struct
 * @return 1 on success, 0 on parse failure
 */
int qr_parse_payload(const char* json, QRResult* result);
