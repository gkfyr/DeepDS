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

    /* Avoid Vercel redirects from URLs such as https://host.app//api/... */
    size_t url_len = strlen(g_session.url);
    while (url_len > 8 && g_session.url[url_len - 1] == '/') {
        g_session.url[--url_len] = '\0';
    }

    /*
     * Nintendo's original SSL service tops out at TLS 1.1. Quick Tunnel HTTP
     * is intentionally used as the compatibility edge; cloudflared encrypts
     * the hop from Cloudflare to the local proxy.
     */
    if (strncmp(g_session.url, "https://", 8) == 0 &&
        strstr(g_session.url, ".trycloudflare.com") != NULL) {
        memmove(
            g_session.url + 7,
            g_session.url + 8,
            strlen(g_session.url + 8) + 1
        );
        memcpy(g_session.url, "http://", 7);
    }

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
