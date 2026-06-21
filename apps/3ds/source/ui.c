/**
 * ui.c — DeepDS UI Rendering (citro2d)
 *
 * Renders the DeepBook trading interface on the 3DS dual screens:
 * - Top (400x240): Orderbook data, balances, session info
 * - Bottom (320x240): BUY/SELL touch buttons with visual feedback
 */

#include "ui.h"
#include <stdio.h>
#include <string.h>
#include <3ds.h>

static C2D_TextBuf  s_text_buf;
static C2D_Font     s_font = NULL;  /* NULL = use system font */

/* Frame counter for animations */
static u32 s_frame = 0;

void ui_init(void) {
    s_text_buf = C2D_TextBufNew(4096);
}

/* ---- Helper: draw filled rectangle ---- */
static void draw_rect(float x, float y, float w, float h, u32 color) {
    C2D_DrawRectSolid(x, y, 0.5f, w, h, color);
}

/* ---- Helper: draw bordered rectangle ---- */
static void draw_border_rect(float x, float y, float w, float h,
                              u32 fill, u32 border) {
    draw_rect(x, y, w, h, fill);
    /* Top */
    draw_rect(x, y, w, 1, border);
    /* Bottom */
    draw_rect(x, y + h - 1, w, 1, border);
    /* Left */
    draw_rect(x, y, 1, h, border);
    /* Right */
    draw_rect(x + w - 1, y, 1, h, border);
}

/* ---- Helper: draw text ---- */
static void draw_text(const char* str, float x, float y, float sz, u32 color) {
    C2D_Text text;
    C2D_TextBufClear(s_text_buf);
    C2D_TextParse(&text, s_text_buf, str);
    C2D_TextOptimize(&text);
    C2D_DrawText(&text, C2D_WithColor | C2D_AtBaseline, x, y, 0.5f, sz, sz, color);
}

/* ============================================================
   TOP SCREEN (400 x 240)
   ============================================================ */

void ui_draw_top(
    const MarketDisplay* market,
    const char* session_id,
    const char* state_name
) {
    char buf[128];
    s_frame++;

    /* Background */
    draw_rect(0, 0, SCREEN_TOP_W, SCREEN_H, COL_BLACK);

    /* Subtle grid lines */
    for (int x = 0; x < SCREEN_TOP_W; x += 40) {
        draw_rect(x, 0, 1, SCREEN_H, C2D_Color32(0, 30, 8, 255));
    }
    for (int y = 0; y < SCREEN_H; y += 30) {
        draw_rect(0, y, SCREEN_TOP_W, 1, C2D_Color32(0, 30, 8, 255));
    }

    /* ── Title bar ── */
    draw_rect(0, 0, SCREEN_TOP_W, 20, C2D_Color32(0, 40, 12, 255));
    draw_text("DEEPDS v0.1 // SUI DEEPBOOK V3", 8, 14, 0.45f, COL_GREEN);

    /* Blinking status dot */
    u32 dot_col = (s_frame % 60 < 30) ? COL_GREEN : C2D_Color32(0, 80, 20, 255);
    draw_rect(380, 6, 8, 8, dot_col);

    /* State indicator */
    snprintf(buf, sizeof(buf), "[%s]", state_name);
    draw_text(buf, 300, 14, 0.4f, COL_GREEN_DIM);

    /* ── Session info ── */
    draw_text("SESSION:", 8, 35, 0.4f, COL_GREEN_DIM);
    if (session_id && strlen(session_id) > 0) {
        /* Show first 8 chars of session ID */
        char short_sid[16];
        strncpy(short_sid, session_id, 8);
        short_sid[8] = '\0';
        snprintf(buf, sizeof(buf), "%s...", short_sid);
        draw_text(buf, 80, 35, 0.4f, COL_GREEN);
    } else {
        draw_text("NOT CONNECTED", 80, 35, 0.4f, COL_YELLOW);
    }

    /* ── Market data panel ── */
    draw_border_rect(8, 45, 190, 90, C2D_Color32(0, 20, 6, 200), COL_GREEN_DARK);
    draw_text("SUI/USDC", 14, 58, 0.45f, COL_BLUE);

    if (market && market->data_valid) {
        snprintf(buf, sizeof(buf), "BID  %.4f", market->bid);
        draw_text(buf, 14, 75, 0.45f, COL_GREEN);

        snprintf(buf, sizeof(buf), "ASK  %.4f", market->ask);
        draw_text(buf, 14, 92, 0.45f, COL_RED);

        snprintf(buf, sizeof(buf), "SPR  %.4f", market->spread);
        draw_text(buf, 14, 109, 0.4f, COL_YELLOW);

        snprintf(buf, sizeof(buf), "VOL  %d", market->volume);
        draw_text(buf, 14, 124, 0.4f, COL_GREEN_DIM);
    } else {
        draw_text("LOADING...", 14, 90, 0.45f, COL_GREEN_DIM);
        /* Spinning indicator */
        const char* spin[] = {"|", "/", "-", "\\"};
        snprintf(buf, sizeof(buf), "%s", spin[(s_frame / 10) % 4]);
        draw_text(buf, 100, 90, 0.5f, COL_GREEN);
    }

    /* ── Balance panel ── */
    draw_border_rect(205, 45, 185, 90, C2D_Color32(0, 20, 6, 200), COL_GREEN_DARK);
    draw_text("WALLET BALANCE", 210, 58, 0.38f, COL_BLUE);

    if (market && market->data_valid) {
        snprintf(buf, sizeof(buf), "SUI   %s", market->sui_balance);
        draw_text(buf, 210, 75, 0.43f, COL_GREEN);

        snprintf(buf, sizeof(buf), "USDC  %s", market->usdc_balance);
        draw_text(buf, 210, 92, 0.43f, COL_GREEN);
    } else {
        draw_text("---", 210, 80, 0.45f, COL_GREEN_DIM);
    }

    /* ── Simple ASCII price chart ── */
    draw_border_rect(8, 143, 384, 72, C2D_Color32(0, 15, 5, 200), COL_GREEN_DARK);
    draw_text("PRICE HISTORY", 14, 155, 0.38f, COL_GREEN_DIM);

    /* Draw a simple "chart" using random-looking bars for demo */
    if (market && market->data_valid) {
        float base_price = market->bid;
        /* Static jitter for visual effect */
        static float chart_vals[30] = {0};
        static int chart_init = 0;
        if (!chart_init) {
            chart_init = 1;
            for (int i = 0; i < 30; i++) {
                chart_vals[i] = base_price + ((i % 7) - 3) * 0.01f;
            }
        }
        chart_vals[s_frame % 30] = base_price;

        for (int i = 0; i < 29; i++) {
            float v1 = chart_vals[i];
            float v2 = chart_vals[(i + 1) % 30];
            float norm1 = (v1 - (base_price - 0.05f)) / 0.1f;
            float norm2 = (v2 - (base_price - 0.05f)) / 0.1f;
            /* Clamp */
            if (norm1 < 0) norm1 = 0; if (norm1 > 1) norm1 = 1;
            if (norm2 < 0) norm2 = 0; if (norm2 > 1) norm2 = 1;
            float y1 = 207 - norm1 * 55;
            float y2 = 207 - norm2 * 55;
            float x1 = 14 + i * 12;
            /* Simple vertical bar */
            draw_rect(x1, (y1 < y2 ? y1 : y2), 2, (y1 < y2 ? y2 - y1 : y1 - y2) + 1, COL_GREEN);
        }
    } else {
        draw_text("AWAITING DATA...", 120, 175, 0.4f, COL_GREEN_DIM);
    }

    /* ── Bottom status bar ── */
    draw_rect(0, 220, SCREEN_TOP_W, 20, C2D_Color32(0, 25, 8, 255));
    draw_text("DEEPBOOK V3 // SUI OVERFLOW 2026 // DEEPDS", 8, 234, 0.35f, COL_GREEN_DARK);
}

/* ============================================================
   BOTTOM SCREEN (320 x 240)
   ============================================================ */

void ui_draw_bottom(
    const TradeResult* last_trade,
    int buy_pressed,
    int sell_pressed
) {
    char buf[128];

    /* Background */
    draw_rect(0, 0, SCREEN_BOT_W, SCREEN_H, COL_BLACK);

    /* Title */
    draw_rect(0, 0, SCREEN_BOT_W, 18, C2D_Color32(0, 35, 10, 255));
    draw_text("TRADING CONTROLS", 60, 13, 0.45f, COL_GREEN);

    /* Quantity display */
    draw_text("QTY: 1.0 SUI", 100, 45, 0.45f, COL_GREEN_DIM);

    /* ── BUY Button ── */
    u32 buy_bg  = buy_pressed  ? C2D_Color32(0, 180, 60, 255)  : C2D_Color32(0, 60, 20, 220);
    u32 buy_brd = buy_pressed  ? COL_GREEN   : C2D_Color32(0, 120, 40, 255);
    draw_border_rect(BTN_BUY_X, BTN_BUY_Y, BTN_BUY_W, BTN_BUY_H, buy_bg, buy_brd);
    draw_text("BUY", BTN_BUY_X + 45, BTN_BUY_Y + 35, 0.7f, COL_GREEN);
    draw_text("1.0 SUI", BTN_BUY_X + 30, BTN_BUY_Y + 58, 0.45f, COL_GREEN_DIM);

    /* Glow effect when pressed */
    if (buy_pressed) {
        draw_rect(BTN_BUY_X - 2, BTN_BUY_Y - 2, BTN_BUY_W + 4, 2, COL_GREEN);
        draw_rect(BTN_BUY_X - 2, BTN_BUY_Y + BTN_BUY_H, BTN_BUY_W + 4, 2, COL_GREEN);
    }

    /* ── SELL Button ── */
    u32 sell_bg  = sell_pressed ? C2D_Color32(180, 30, 50, 220)  : C2D_Color32(60, 10, 18, 220);
    u32 sell_brd = sell_pressed ? COL_RED    : C2D_Color32(160, 40, 60, 255);
    draw_border_rect(BTN_SELL_X, BTN_SELL_Y, BTN_SELL_W, BTN_SELL_H, sell_bg, sell_brd);
    draw_text("SELL", BTN_SELL_X + 40, BTN_SELL_Y + 35, 0.7f, COL_RED);
    draw_text("1.0 SUI", BTN_SELL_X + 30, BTN_SELL_Y + 58, 0.45f, C2D_Color32(200, 80, 100, 255));

    if (sell_pressed) {
        draw_rect(BTN_SELL_X - 2, BTN_SELL_Y - 2, BTN_SELL_W + 4, 2, COL_RED);
        draw_rect(BTN_SELL_X - 2, BTN_SELL_Y + BTN_SELL_H, BTN_SELL_W + 4, 2, COL_RED);
    }

    /* ── Utility buttons ── */
    draw_border_rect(BTN_REFRESH_X, BTN_REFRESH_Y, BTN_REFRESH_W, BTN_REFRESH_H,
                     C2D_Color32(0, 20, 30, 200), C2D_Color32(0, 100, 150, 255));
    draw_text("REFRESH", BTN_REFRESH_X + 15, BTN_REFRESH_Y + 25, 0.4f, COL_BLUE);

    draw_border_rect(BTN_QUIT_X, BTN_QUIT_Y, BTN_QUIT_W, BTN_QUIT_H,
                     C2D_Color32(30, 10, 10, 200), C2D_Color32(150, 40, 40, 255));
    draw_text("QUIT", BTN_QUIT_X + 28, BTN_QUIT_Y + 25, 0.4f, C2D_Color32(200, 80, 80, 255));

    /* ── Trade result feedback ── */
    if (last_trade && last_trade->show) {
        u32 result_bg = last_trade->success
            ? C2D_Color32(0, 50, 15, 220)
            : C2D_Color32(50, 10, 10, 220);
        u32 result_col = last_trade->success ? COL_GREEN : COL_RED;

        draw_border_rect(10, 220, 300, 18, result_bg, result_col);

        if (last_trade->success) {
            snprintf(buf, sizeof(buf), "OK  TX: %s", last_trade->digest);
        } else {
            snprintf(buf, sizeof(buf), "ERR %s", last_trade->digest);
        }
        draw_text(buf, 14, 233, 0.35f, result_col);
    } else {
        draw_text("TOUCH BUY OR SELL TO TRADE", 35, 234, 0.38f, C2D_Color32(0, 60, 20, 255));
    }
}

/* ---- Touch area detection ---- */

static int point_in_rect(u16 px, u16 py, int rx, int ry, int rw, int rh) {
    return (px >= rx && px < rx + rw && py >= ry && py < ry + rh);
}

int ui_touch_in_buy(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_BUY_X, BTN_BUY_Y, BTN_BUY_W, BTN_BUY_H);
}

int ui_touch_in_sell(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_SELL_X, BTN_SELL_Y, BTN_SELL_W, BTN_SELL_H);
}

int ui_touch_in_refresh(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_REFRESH_X, BTN_REFRESH_Y, BTN_REFRESH_W, BTN_REFRESH_H);
}

int ui_touch_in_quit(u16 tx, u16 ty) {
    return point_in_rect(tx, ty, BTN_QUIT_X, BTN_QUIT_Y, BTN_QUIT_W, BTN_QUIT_H);
}
