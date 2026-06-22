/**
 * ui.h — DeepDS dual-screen UI
 *
 * A compact Sui-inspired interface:
 * - Top screen: live BTC market, strike, marks, balance
 * - Bottom screen: large UP/DOWN touch targets and pairing/error guidance
 */

#pragma once

#include <citro2d.h>

#define SCREEN_TOP_W 400
#define SCREEN_BOT_W 320
#define SCREEN_H     240

/* Sui-inspired palette */
#define COL_BG          C2D_Color32(244, 250, 255, 255)
#define COL_SURFACE     C2D_Color32(255, 255, 255, 255)
#define COL_INK         C2D_Color32(16, 42, 67, 255)
#define COL_MUTED       C2D_Color32(98, 125, 152, 255)
#define COL_LINE        C2D_Color32(216, 231, 241, 255)
#define COL_BLUE        C2D_Color32(77, 162, 255, 255)
#define COL_BLUE_SOFT   C2D_Color32(223, 241, 255, 255)
#define COL_NAVY        C2D_Color32(7, 27, 45, 255)
#define COL_GREEN       C2D_Color32(40, 184, 136, 255)
#define COL_GREEN_SOFT  C2D_Color32(232, 248, 243, 255)
#define COL_CORAL       C2D_Color32(255, 107, 107, 255)
#define COL_CORAL_SOFT  C2D_Color32(255, 239, 239, 255)
#define COL_WHITE       C2D_Color32(255, 255, 255, 255)
#define COL_BLACK       COL_BG

/* Large, thumb-friendly controls */
#define BTN_BUY_X       12
#define BTN_BUY_Y       66
#define BTN_BUY_W       142
#define BTN_BUY_H       104

#define BTN_SELL_X      166
#define BTN_SELL_Y      66
#define BTN_SELL_W      142
#define BTN_SELL_H      104

#define BTN_REFRESH_X   12
#define BTN_REFRESH_Y   184
#define BTN_REFRESH_W   142
#define BTN_REFRESH_H   38

#define BTN_QUIT_X      166
#define BTN_QUIT_Y      184
#define BTN_QUIT_W      142
#define BTN_QUIT_H      38

typedef struct {
    float spot;
    float strike;
    float up_price;
    float down_price;
    long long expiry;
    char sui_balance[16];
    char dusdc_balance[16];
    int data_valid;
} MarketDisplay;

typedef struct {
    int success;
    char digest[24];
    int show;
    int countdown;
} TradeResult;

void ui_init(void);
void ui_exit(void);
void ui_begin_frame(void);

void ui_draw_top(
    const MarketDisplay* market,
    const char* session_id,
    const char* state_name
);

void ui_draw_bottom(
    const TradeResult* last_trade,
    int up_pressed,
    int down_pressed,
    const char* state_name,
    const char* message
);

int ui_touch_in_buy(u16 tx, u16 ty);
int ui_touch_in_down(u16 tx, u16 ty);
int ui_touch_in_refresh(u16 tx, u16 ty);
int ui_touch_in_quit(u16 tx, u16 ty);
