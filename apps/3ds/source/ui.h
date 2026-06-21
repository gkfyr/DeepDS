/**
 * ui.h — DeepDS UI rendering for Nintendo 3DS
 *
 * Top screen (400x240): Orderbook data, session info, price chart
 * Bottom screen (320x240): BUY/SELL touch buttons, status
 *
 * Uses citro2d for 2D rendering on top of citro3d.
 */

#pragma once

#include <citro2d.h>

/* Screen dimensions */
#define SCREEN_TOP_W    400
#define SCREEN_BOT_W    320
#define SCREEN_H        240

/* Color palette (phosphor green terminal) */
#define COL_BLACK       C2D_Color32(10,  10,  15,  255)  /* #0a0a0f */
#define COL_GREEN       C2D_Color32(0,   255, 65,  255)  /* #00ff41 */
#define COL_GREEN_DIM   C2D_Color32(0,   160, 40,  255)  /* dim green */
#define COL_GREEN_DARK  C2D_Color32(0,   50,  15,  200)  /* panel bg */
#define COL_BLUE        C2D_Color32(0,   255, 255, 255)  /* cyan */
#define COL_RED         C2D_Color32(255, 45,  85,  255)  /* #ff2d55 */
#define COL_YELLOW      C2D_Color32(255, 214, 10,  255)  /* #ffd60a */
#define COL_WHITE       C2D_Color32(220, 220, 220, 255)
#define COL_GRAY        C2D_Color32(50,  50,  60,  255)
#define COL_TRANSPARENT C2D_Color32(0,   0,   0,   0)

/* Touch button areas on bottom screen */
#define BTN_BUY_X    10
#define BTN_BUY_Y    60
#define BTN_BUY_W    140
#define BTN_BUY_H    80

#define BTN_SELL_X   170
#define BTN_SELL_Y   60
#define BTN_SELL_W   140
#define BTN_SELL_H   80

#define BTN_REFRESH_X  40
#define BTN_REFRESH_Y  170
#define BTN_REFRESH_W  100
#define BTN_REFRESH_H  40

#define BTN_QUIT_X   180
#define BTN_QUIT_Y   170
#define BTN_QUIT_W   100
#define BTN_QUIT_H   40

/* Market data for display */
typedef struct {
    float bid;
    float ask;
    float spread;
    int   volume;
    char  sui_balance[16];
    char  usdc_balance[16];
    int   data_valid;
} MarketDisplay;

/* Trade result for feedback */
typedef struct {
    int   success;
    char  digest[24];  /* shortened tx digest */
    int   show;        /* 1 = show result, 0 = hide */
    int   countdown;   /* frames to show result */
} TradeResult;

/**
 * Initialize UI (must call after gfxInitDefault + C2D_Init).
 */
void ui_init(void);

/**
 * Draw the top screen.
 * Shows: title, session info, market data, price trend
 */
void ui_draw_top(
    const MarketDisplay* market,
    const char* session_id,
    const char* state_name
);

/**
 * Draw the bottom touch screen.
 * Shows: BUY/SELL buttons, quantity selector, status
 */
void ui_draw_bottom(
    const TradeResult* last_trade,
    int buy_pressed,
    int sell_pressed
);

/**
 * Check if a touch point is within a button area.
 */
int ui_touch_in_buy(u16 tx, u16 ty);
int ui_touch_in_sell(u16 tx, u16 ty);
int ui_touch_in_refresh(u16 tx, u16 ty);
int ui_touch_in_quit(u16 tx, u16 ty);
