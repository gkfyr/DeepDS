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

    draw_rect(0, 0, SCREEN_TOP_W, SCREEN_H, COL_BG);
    draw_brand(SCREEN_TOP_W, state_name);

    if (!market || !market->data_valid) {
        draw_empty_top(state_name);
        return;
    }

    draw_text("BTC  /  LIVE ORACLE", 16, 53, 0.40f, COL_BLUE);
    snprintf(buf, sizeof(buf), "$%.2f", market->spot);
    draw_text(buf, 16, 88, 0.86f, COL_INK);

    long long age_ms = (long long)osGetTime() - market->updated_at;
    int is_live = age_ms >= 0 && age_ms < 15000;
    draw_pill(320, 43, 64, 26, is_live ? COL_GREEN_SOFT : COL_CORAL_SOFT);
    draw_rect(330, 53, 7, 7, is_live ? COL_GREEN : COL_CORAL);
    draw_text(is_live ? "LIVE" : "STALE", 345, 62, 0.38f, is_live ? COL_GREEN : COL_CORAL);

    draw_card(14, 101, 250, 103, COL_SURFACE, COL_LINE);
    draw_text("REAL PRICE HISTORY", 26, 123, 0.39f, COL_MUTED);
    snprintf(buf, sizeof(buf), "FWD $%.0f", market->forward);
    draw_text(buf, 174, 123, 0.34f, COL_MUTED);
    if (market->history_count >= 2) {
        float min_price = market->history[0];
        float max_price = market->history[0];
        for (int i = 1; i < market->history_count; i++) {
            if (market->history[i] < min_price) min_price = market->history[i];
            if (market->history[i] > max_price) max_price = market->history[i];
        }
        float range = max_price - min_price;
        if (range < 1.0f) range = 1.0f;
        for (int i = 1; i < market->history_count; i++) {
            float x0 = 27 + (i - 1) * 218.0f / (market->history_count - 1);
            float x1 = 27 + i * 218.0f / (market->history_count - 1);
            float y0 = 187 - (market->history[i - 1] - min_price) * 51.0f / range;
            float y1 = 187 - (market->history[i] - min_price) * 51.0f / range;
            C2D_DrawLine(x0, y0, COL_BLUE, x1, y1, COL_BLUE, 2.0f, 0.6f);
        }
        snprintf(buf, sizeof(buf), "$%.0f", max_price);
        draw_text(buf, 27, 143, 0.34f, COL_MUTED);
        snprintf(buf, sizeof(buf), "$%.0f", min_price);
        draw_text(buf, 27, 198, 0.34f, COL_MUTED);
    } else {
        draw_text("Waiting for oracle history", 28, 166, 0.42f, COL_MUTED);
    }

    draw_card(273, 101, 113, 48, COL_SURFACE, COL_LINE);
    draw_text("STRIKE", 285, 121, 0.38f, COL_MUTED);
    snprintf(buf, sizeof(buf), "$%.0f", market->strike);
    draw_text(buf, 285, 143, 0.50f, COL_INK);

    draw_card(273, 156, 113, 48, COL_SURFACE, COL_LINE);
    draw_text("EXPIRES IN", 285, 176, 0.38f, COL_MUTED);
    long long remaining = market->expiry - (long long)osGetTime();
    if (remaining < 0) remaining = 0;
    snprintf(buf, sizeof(buf), "%02lld:%02lld", remaining / 60000, (remaining / 1000) % 60);
    draw_text(buf, 285, 198, 0.50f, remaining > 60000 ? COL_INK : COL_CORAL);

    draw_text("FUNDS", 16, 227, 0.37f, COL_MUTED);
    snprintf(buf, sizeof(buf), "%s dUSDC", market->dusdc_balance);
    draw_text(buf, 62, 228, 0.40f, COL_INK);
    snprintf(buf, sizeof(buf), "UP %.1fc", market->up_price * 100.0f);
    draw_text(buf, 170, 228, 0.40f, COL_GREEN);
    snprintf(buf, sizeof(buf), "DOWN %.1fc", market->down_price * 100.0f);
    draw_text(buf, 250, 228, 0.40f, COL_CORAL);

    if (session_id && session_id[0]) {
        snprintf(buf, sizeof(buf), "%.6s", session_id);
        draw_text(buf, 356, 228, 0.34f, COL_MUTED);
    }
}

static void draw_action_button(
    float x,
    float y,
    float w,
    float h,
    int pressed,
    int selected,
    int is_up,
    int quantity
) {
    u32 soft = is_up ? COL_GREEN_SOFT : COL_CORAL_SOFT;
    u32 strong = is_up ? COL_GREEN : COL_CORAL;
    u32 fill = pressed ? strong : soft;
    u32 text = pressed ? COL_WHITE : strong;

    if (selected) {
        draw_card(x - 3, y - 3, w + 6, h + 6, COL_BLUE, COL_BLUE);
        draw_card(x, y, w, h, fill, strong);
    } else {
        draw_card(x, y, w, h, fill, strong);
    }
    draw_text(is_up ? "BTC ABOVE" : "BTC BELOW", x + 14, y + 23, 0.40f, text);
    draw_text(is_up ? "UP" : "DOWN", x + 14, y + 62, 0.82f, text);
    char quantity_text[24];
    snprintf(quantity_text, sizeof(quantity_text), "%d POSITION%s", quantity, quantity > 1 ? "S" : "");
    draw_text(quantity_text, x + 14, y + 82, 0.36f, text);
    if (selected) {
        draw_pill(x + w - 40, y + 10, 28, 18, COL_BLUE);
        draw_text("A", x + w - 30, y + 23, 0.34f, COL_WHITE);
    }
}

static void draw_pairing_bottom(const char* message) {
    draw_text("Connect DeepDS", 18, 54, 0.72f, COL_INK);
    draw_text("Keep the full QR and white border visible.", 18, 80, 0.35f, COL_MUTED);
    draw_text("QR CAMERA v1.3", 220, 54, 0.34f, COL_BLUE);

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
    int selected_action,
    int quantity,
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

    draw_text("Build your order", 14, 49, 0.54f, COL_INK);
    draw_text("< > SIDE   ^ v QTY   A BUY", 14, 63, 0.33f, COL_MUTED);
    draw_text("X UPDATE   START EXIT", 168, 63, 0.30f, COL_MUTED);

    draw_card(82, 72, 156, 25, COL_BLUE_SOFT, COL_BLUE);
    draw_text("QUANTITY", 96, 90, 0.34f, COL_BLUE);
    snprintf(buf, sizeof(buf), "%d", quantity);
    draw_text(buf, 201, 91, 0.50f, COL_INK);

    draw_action_button(
        BTN_BUY_X, BTN_BUY_Y, BTN_BUY_W, BTN_BUY_H,
        up_pressed, selected_action == 0, 1, quantity
    );
    draw_action_button(
        BTN_SELL_X, BTN_SELL_Y, BTN_SELL_W, BTN_SELL_H,
        down_pressed, selected_action == 1, 0, quantity
    );

    if (message && message[0]) {
        draw_card(12, 201, 296, 31, COL_BLUE, COL_BLUE);
        draw_text(message, 26, 222, 0.36f, COL_WHITE);
    } else if (last_trade && last_trade->show) {
        u32 fill = last_trade->success ? COL_GREEN : COL_CORAL;
        draw_card(12, 201, 296, 31, fill, fill);
        if (last_trade->success && last_trade->action[0]) {
            snprintf(
                buf,
                sizeof(buf),
                "LAST: %d %s  /  %.36s",
                last_trade->quantity,
                last_trade->action,
                last_trade->message
            );
        } else {
            snprintf(buf, sizeof(buf), "%.44s", last_trade->message);
        }
        draw_text(buf, 23, 222, 0.34f, COL_WHITE);
    } else {
        draw_card(12, 201, 296, 31, COL_SURFACE, COL_LINE);
        draw_text("No orders yet", 105, 222, 0.36f, COL_MUTED);
    }
}

void ui_draw_loading(
    int top_screen,
    const char* title,
    const char* detail,
    unsigned int frame
) {
    float width = top_screen ? SCREEN_TOP_W : SCREEN_BOT_W;
    float card_x = top_screen ? 48.0f : 24.0f;
    float card_w = top_screen ? 304.0f : 272.0f;
    static const char* spinner[] = { ".", "..", "...", "...." };

    draw_rect(0, 0, width, SCREEN_H, COL_BG);
    draw_brand(width, "LOADING");
    draw_card(card_x, 62, card_w, 116, COL_SURFACE, COL_BLUE);
    draw_pill(card_x + 18, 82, 76, 22, COL_BLUE_SOFT);
    draw_text("PLEASE WAIT", card_x + 29, 97, 0.28f, COL_BLUE);
    draw_text(title ? title : "Loading", card_x + 18, 132, 0.60f, COL_INK);

    char line[128];
    snprintf(
        line,
        sizeof(line),
        "%s%s",
        detail ? detail : "Contacting server",
        spinner[(frame / 15) % 4]
    );
    draw_text(line, card_x + 18, 157, 0.32f, COL_MUTED);

    float progress_w = card_w - 36;
    draw_rect(card_x + 18, 165, progress_w, 5, COL_LINE);
    draw_rect(
        card_x + 18,
        165,
        28 + (float)((frame * 5) % (unsigned int)(progress_w - 28)),
        5,
        COL_BLUE
    );

    if (!top_screen) {
        draw_text("Do not close the lid", 87, 211, 0.30f, COL_MUTED);
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
