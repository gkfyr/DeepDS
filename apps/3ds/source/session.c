/**
 * session.c — DeepDS Session State Implementation
 */

#include "session.h"
#include <string.h>
#include <stdio.h>

Session g_session;

void session_init(void) {
    memset(&g_session, 0, sizeof(Session));
    g_session.is_valid = 0;
}

int session_set(const char* url, const char* sid) {
    if (!url || !sid) return 0;
    if (strlen(url) >= SESSION_URL_MAX) return 0;
    if (strlen(sid) >= SESSION_SID_MAX) return 0;

    strncpy(g_session.url, url, SESSION_URL_MAX - 1);
    strncpy(g_session.sid, sid, SESSION_SID_MAX - 1);
    g_session.url[SESSION_URL_MAX - 1] = '\0';
    g_session.sid[SESSION_SID_MAX - 1] = '\0';
    g_session.is_valid = 1;
    return 1;
}

void session_clear(void) {
    memset(&g_session, 0, sizeof(Session));
    g_session.is_valid = 0;
}

int session_is_valid(void) {
    return g_session.is_valid;
}
