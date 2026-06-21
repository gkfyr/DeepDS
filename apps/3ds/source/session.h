/**
 * session.h — DeepDS Session State
 * Holds proxy URL and session ID after QR scan.
 */

#pragma once

#define SESSION_URL_MAX 128
#define SESSION_SID_MAX 37   /* UUID v4: 36 chars + null */

typedef struct {
    char url[SESSION_URL_MAX];   /* e.g. "http://192.168.1.5:3001" */
    char sid[SESSION_SID_MAX];   /* UUID session ID */
    int  is_valid;               /* 1 if session is set */
} Session;

/* Global session state */
extern Session g_session;

void session_init(void);
int  session_set(const char* url, const char* sid);
void session_clear(void);
int  session_is_valid(void);
