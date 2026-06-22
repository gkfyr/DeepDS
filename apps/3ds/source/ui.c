/**
 * ui.c — Sui-inspired DeepDS UI rendered with Citro2D
 */

#include "ui.h"
#include <stdio.h>
#include <string.h>
#include <3ds.h>

static C2D_TextBuf s_text_buf;
static C2D_SpriteSheet s_logo_sheet;
static C2D_Image s_logo_image;
static int s_logo_ready = 0;
static u32 s_frame = 0;

void ui_init(void) {
    s_text_buf = C2D_TextBufNew(16384);
    s_logo_sheet = C2D_SpriteSheetLoad("romfs:/gfx/logo.t3x");
    if (s_logo_sheet) {
        s_logo_image = C2D_SpriteSheetGetImage(s_logo_sheet, 0);
        s_logo_ready = 1;
    }
}

void ui_exit(void) {
    if (s_logo_sheet) {
        C2D_SpriteSheetFree(s_logo_sheet);
        s_logo_sheet = NULL;
        s_logo_ready = 0;
    }
    if (s_text_buf) {
        C2D_TextBufDelete(s_text_buf);
        s_text_buf = NULL;
    }
}

void ui_begin_frame(void) {
    C2D_TextBufClear(s_text_buf);
}

static void draw_rect(float x, float y, float w, float h, u32 color) {
    C2D_DrawRectSolid(x, y, 0.5f, w, h, color);
}

static void draw_rect_at(
    float x,
    float y,
    float depth,
    float w,
    float h,
    u32 color
) {
    C2D_DrawRectSolid(x, y, depth, w, h, color);
}

/* Low-resolution rounded card using stepped corners. */
static void draw_card(float x, float y, float w, float h, u32 fill, u32 border) {
    draw_rect(x + 4, y, w - 8, h, fill);
    draw_rect(x, y + 4, w, h - 8, fill);
    draw_rect(x + 4, y, w - 8, 1, border);
    draw_rect(x + 4, y + h - 1, w - 8, 1, border);
    draw_rect(x, y + 4, 1, h - 8, border);
    draw_rect(x + w - 1, y + 4, 1, h - 8, border);
    draw_rect(x + 2, y + 2, 2, 1, border);
    draw_rect(x + w - 4, y + 2, 2, 1, border);
    draw_rect(x + 2, y + h - 3, 2, 1, border);
    draw_rect(x + w - 4, y + h - 3, 2, 1, border);
}

static void draw_pill(float x, float y, float w, float h, u32 fill) {
    draw_rect(x + h / 2, y, w - h, h, fill);
    C2D_DrawCircleSolid(x + h / 2, y + h / 2, 0.5f, h / 2, fill);
    C2D_DrawCircleSolid(x + w - h / 2, y + h / 2, 0.5f, h / 2, fill);
}

static void draw_text(const char* str, float x, float y, float size, u32 color) {
    C2D_Text text;
    C2D_TextParse(&text, s_text_buf, str);
    C2D_TextOptimize(&text);
    C2D_DrawText(
        &text,
        C2D_WithColor | C2D_AtBaseline,
        x,
        y,
        0.5f,
        size,
        size,
        color
    );
}

static void draw_text_at(
    const char* str,
    float x,
    float y,
    float depth,
    float size,
    u32 color
) {
    C2D_Text text;
    C2D_TextParse(&text, s_text_buf, str);
    C2D_TextOptimize(&text);
    C2D_DrawText(
        &text,
        C2D_WithColor | C2D_AtBaseline,
        x,
        y,
        depth,
        size,
        size,
        color
    );
}

static void draw_brand(float width, const char* state_name) {
    draw_card(10, 8, 34, 22, COL_SURFACE, COL_LINE);
    if (s_logo_ready) {
        C2D_DrawImageAt(
            s_logo_image,
            17,
            9,
            0.6f,
            NULL,
            0.3125f,
            0.3125f
        );
    } else {
        draw_text("DS", 19, 24, 0.42f, COL_BLUE);
    }
    draw_text("DeepDS", 51, 24, 0.52f, COL_INK);

    float pill_w = 64;
    draw_pill(width - pill_w - 10, 9, pill_w, 20, COL_BLUE_SOFT);
    draw_text(state_name, width - pill_w - 2, 23, 0.34f, COL_INK);
}

static void draw_empty_top(const char* state_name) {
    if (strcmp(state_name, "ERROR") == 0) {
        draw_text("Connection failed", 20, 76, 0.82f, COL_CORAL);
        draw_text("The session or server could not be reached.", 20, 105, 0.41f, COL_MUTED);
        draw_card(20, 140, 360, 58, COL_CORAL_SOFT, COL_CORAL);
        draw_text("A", 38, 178, 0.72f, COL_CORAL);
        draw_text("Return to pairing", 75, 172, 0.52f, COL_INK);
        draw_text("Check the error details below.", 75, 190, 0.31f, COL_MUTED);
        return;
    }

    draw_text("Scan to pair", 20, 70, 0.82f, COL_INK);
    draw_text("Point the outer camera at the QR code", 20, 99, 0.42f, COL_MUTED);
    draw_text("shown on the DeepDS web app.", 20, 118, 0.42f, COL_MUTED);

    draw_card(20, 140, 360, 70, COL_BLUE_SOFT, COL_BLUE);
    draw_rect(42, 154, 42, 4, COL_BLUE);
    draw_rect(42, 154, 4, 42, COL_BLUE);
    draw_rect(80, 154, 4, 42, COL_BLUE);
    draw_rect(42, 192, 42, 4, COL_BLUE);
    draw_text("SCANNING", 102, 169, 0.54f, COL_BLUE);
    draw_text("A  Enter details manually", 102, 194, 0.36f, COL_INK);
}

void ui_draw_qr_top(
    const C2D_Image* preview,
    const QRScannerStatus* status
) {
    draw_rect(0, 0, SCREEN_TOP_W, SCREEN_H, COL_BG);
    draw_brand(SCREEN_TOP_W, "QR SCAN");

    draw_card(76, 38, 248, 188, COL_NAVY, COL_BLUE);
    if (preview) {
        /* Must be in front of the card (cards render at depth 0.5). */
        C2D_DrawImageAt(*preview, 80, 42, 0.6f, NULL, 0.75f, 0.75f);

        /* Quiet-zone guide: keep the full code and some white margin inside. */
        draw_rect_at(126, 61, 0.7f, 44, 2, COL_WHITE);
        draw_rect_at(126, 61, 0.7f, 2, 44, COL_WHITE);
        draw_rect_at(230, 61, 0.7f, 44, 2, COL_WHITE);
        draw_rect_at(272, 61, 0.7f, 2, 44, COL_WHITE);
        draw_rect_at(126, 163, 0.7f, 2, 44, COL_WHITE);
        draw_rect_at(126, 205, 0.7f, 44, 2, COL_WHITE);
        draw_rect_at(272, 163, 0.7f, 2, 44, COL_WHITE);
        draw_rect_at(230, 205, 0.7f, 44, 2, COL_WHITE);
    } else {
        draw_text("STARTING CAMERA", 126, 130, 0.42f, COL_WHITE);
    }

    if (status && status->qr_candidates > 0) {
        draw_rect_at(152, 211, 0.7f, 96, 15, COL_GREEN);
        draw_text_at("QR DETECTED", 164, 222, 0.8f, 0.27f, COL_WHITE);
    }
}

void ui_draw_top(
    const MarketDisplay* market,
    const char* session_id,
    const char* state_name
) {
    char buf[96];
    s_frame++;

    draw_rect(0, 0, SCREEN_TOP_W, SCREEN_H, COL_BG);
    draw_brand(SCREEN_TOP_W, state_name);

    if (!market || !market->data_valid) {
        draw_empty_top(state_name);
        return;
    }

    draw_text("BTC / 15 MIN", 16, 54, 0.38f, COL_BLUE);
    snprintf(buf, sizeof(buf), "$%.2f", market->spot);
    draw_text(buf, 16, 91, 0.92f, COL_INK);

    draw_pill(298, 44, 86, 25, COL_GREEN_SOFT);
    draw_rect(308, 54, 6, 6, COL_GREEN);
    draw_text("LIVE MARKET", 320, 61, 0.30f, COL_GREEN);

    /* Simple Sui-blue price tape */
    static const int bars[18] = {
        12, 18, 15, 24, 21, 29, 26, 35, 31,
        41, 37, 48, 43, 55, 49, 61, 56, 68
    };
    draw_card(14, 105, 250, 104, COL_SURFACE, COL_LINE);
    draw_text("PRICE TAPE", 26, 125, 0.32f, COL_MUTED);
    for (int i = 0; i < 18; i++) {
        int h = bars[(i + (s_frame / 45)) % 18];
        draw_rect(27 + i * 12, 194 - h, 8, h, COL_BLUE);
    }
    draw_rect(26, 194, 220, 1, COL_LINE);

    draw_card(273, 105, 113, 48, COL_SURFACE, COL_LINE);
    draw_text("STRIKE", 285, 124, 0.30f, COL_MUTED);
    snprintf(buf, sizeof(buf), "$%.0f", market->strike);
    draw_text(buf, 285, 145, 0.53f, COL_INK);

    draw_card(273, 161, 113, 48, COL_SURFACE, COL_LINE);
    draw_text("SESSION FUNDS", 285, 180, 0.27f, COL_MUTED);
    snprintf(buf, sizeof(buf), "%s dUSDC", market->dusdc_balance);
    draw_text(buf, 285, 201, 0.43f, COL_INK);

    draw_text("UP", 16, 229, 0.31f, COL_GREEN);
    snprintf(buf, sizeof(buf), "%.1fc", market->up_price * 100.0f);
    draw_text(buf, 39, 229, 0.38f, COL_INK);
    draw_text("DOWN", 91, 229, 0.31f, COL_CORAL);
    snprintf(buf, sizeof(buf), "%.1fc", market->down_price * 100.0f);
    draw_text(buf, 130, 229, 0.38f, COL_INK);

    if (session_id && session_id[0]) {
        snprintf(buf, sizeof(buf), "SESSION %.8s", session_id);
        draw_text(buf, 292, 229, 0.27f, COL_MUTED);
    }
}

static void draw_action_button(
    float x,
    float y,
    float w,
    float h,
    int pressed,
    int is_up
) {
    u32 soft = is_up ? COL_GREEN_SOFT : COL_CORAL_SOFT;
    u32 strong = is_up ? COL_GREEN : COL_CORAL;
    u32 fill = pressed ? strong : soft;
    u32 text = pressed ? COL_WHITE : strong;

    draw_card(x, y, w, h, fill, strong);
    draw_text(is_up ? "BTC ABOVE" : "BTC BELOW", x + 14, y + 25, 0.32f, text);
    draw_text(is_up ? "UP" : "DOWN", x + 14, y + 70, 0.90f, text);
    draw_text("MAX 1 dUSDC", x + 14, y + 92, 0.31f, text);
}

static void draw_pairing_bottom(const char* message) {
    draw_text("Connect DeepDS", 18, 54, 0.72f, COL_INK);
    draw_text("Keep the full QR and white border visible.", 18, 80, 0.35f, COL_MUTED);
    draw_text("QR CAMERA v0.7", 220, 54, 0.25f, COL_BLUE);

    draw_card(18, 98, 284, 75, COL_SURFACE, COL_BLUE);
    draw_rect(34, 114, 28, 3, COL_BLUE);
    draw_rect(34, 114, 3, 28, COL_BLUE);
    draw_rect(59, 114, 3, 28, COL_BLUE);
    draw_rect(34, 139, 28, 3, COL_BLUE);
    draw_text("Camera pairing active", 79, 127, 0.45f, COL_INK);
    draw_text(message && message[0] ? message : "Waiting for a clear frame", 79, 150, 0.29f, COL_MUTED);
    draw_text("A", 34, 194, 0.45f, COL_BLUE);
    draw_text("Manual pairing", 58, 194, 0.39f, COL_INK);

    draw_text("START exits to Homebrew Launcher", 58, 229, 0.31f, COL_MUTED);
}

void ui_draw_bottom(
    const TradeResult* last_trade,
    int up_pressed,
    int down_pressed,
    const char* state_name,
    const char* message
) {
    char buf[96];

    draw_rect(0, 0, SCREEN_BOT_W, SCREEN_H, COL_BG);
    draw_brand(SCREEN_BOT_W, state_name);

    if (strcmp(state_name, "QR SCAN") == 0) {
        draw_pairing_bottom(message);
        return;
    }

    if (strcmp(state_name, "ERROR") == 0) {
        draw_text("Could not connect", 18, 72, 0.72f, COL_CORAL);
        draw_text(message && message[0] ? message : "Check proxy and Wi-Fi.", 18, 99, 0.36f, COL_MUTED);
        draw_card(18, 130, 284, 58, COL_BLUE_SOFT, COL_BLUE);
        draw_text("A", 34, 167, 0.76f, COL_BLUE);
        draw_text("Try pairing again", 72, 162, 0.53f, COL_INK);
        draw_text("START exits", 118, 224, 0.31f, COL_MUTED);
        return;
    }

    draw_text("Choose the next move", 14, 54, 0.60f, COL_INK);
    draw_action_button(BTN_BUY_X, BTN_BUY_Y, BTN_BUY_W, BTN_BUY_H, up_pressed, 1);
    draw_action_button(BTN_SELL_X, BTN_SELL_Y, BTN_SELL_W, BTN_SELL_H, down_pressed, 0);

    draw_card(
        BTN_REFRESH_X,
        BTN_REFRESH_Y,
        BTN_REFRESH_W,
        BTN_REFRESH_H,
        COL_SURFACE,
        COL_LINE
    );
    draw_text("REFRESH", BTN_REFRESH_X + 39, BTN_REFRESH_Y + 25, 0.38f, COL_BLUE);

    draw_card(
        BTN_QUIT_X,
        BTN_QUIT_Y,
        BTN_QUIT_W,
        BTN_QUIT_H,
        COL_SURFACE,
        COL_LINE
    );
    draw_text("EXIT", BTN_QUIT_X + 54, BTN_QUIT_Y + 25, 0.38f, COL_MUTED);

    if (last_trade && last_trade->show) {
        u32 fill = last_trade->success ? COL_GREEN : COL_CORAL;
        draw_pill(26, 224, 268, 14, fill);
        if (last_trade->success) {
            snprintf(buf, sizeof(buf), "FILLED  %.20s", last_trade->digest);
        } else {
            snprintf(buf, sizeof(buf), "TRADE FAILED");
        }
        draw_text(buf, 54, 236, 0.27f, COL_WHITE);
    }
}

static int point_in_rect(u16 px, u16 py, int rx, int ry, int rw, int rh) {
    return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
}

int ui_touch_in_buy(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_BUY_X, BTN_BUY_Y, BTN_BUY_W, BTN_BUY_H);
}

int ui_touch_in_down(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_SELL_X, BTN_SELL_Y, BTN_SELL_W, BTN_SELL_H);
}

int ui_touch_in_refresh(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_REFRESH_X, BTN_REFRESH_Y, BTN_REFRESH_W, BTN_REFRESH_H);
}

int ui_touch_in_quit(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_QUIT_X, BTN_QUIT_Y, BTN_QUIT_W, BTN_QUIT_H);
}
