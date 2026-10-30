/**
 * Headers for responses that stream (the AI's answer, the share page's updates). They
 * tell a proxy in front of a hosted server (Cloudflare, Caddy, nginx) to pass each part
 * on as it comes, rather than holding it back to compress or cache the whole.
 */
export const STREAM_HEADERS = { "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" };

/** How often a quiet stream says it's still there: under the usual proxy idle timeouts (Cloudflare's is 100 s). */
export const KEEP_ALIVE_MS = 25_000;
