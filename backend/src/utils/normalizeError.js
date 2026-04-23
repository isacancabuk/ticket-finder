/**
 * normalizeError(err)
 *
 * Central error classification utility.
 * Takes an axios error (or any Error) and returns a structured object
 * with a consistent category, message, and metadata.
 *
 * Designed to be reusable across fetchDE, fetchUK, scheduler, and
 * any future request layer.
 *
 * @param {Error} err - An axios error or generic Error
 * @returns {{
 *   category:     string,
 *   httpStatus:   number|null,
 *   message:      string,
 *   errorCode:    string|null,
 *   responseBody: string|null,
 *   retryable:    boolean,
 * }}
 */

export function normalizeError(err) {
  const httpStatus = err.response?.status ?? null;
  const errorCode = err.code ?? null;

  // Capture response body snippet for diagnostics (max 500 chars)
  let responseBody = null;
  if (err.response?.data) {
    responseBody =
      typeof err.response.data === "string"
        ? err.response.data.slice(0, 500)
        : JSON.stringify(err.response.data).slice(0, 500);
  }

  // ── Classification ──────────────────────────────────────────
  let category = "UNKNOWN";
  let retryable = false;
  let message = err.message || "Unknown error";

  if (httpStatus === 403) {
    const bodyStr = (responseBody || "").toLowerCase();
    if (
      bodyStr.includes('"block"') ||
      bodyStr.includes('"response":"block"') ||
      bodyStr.includes("\"response\":\"block\"")
    ) {
      category = "AUTH_OR_BLOCK";
      message = "403 — anti-bot block detected";
    } else {
      category = "AUTH_EXPIRED";
      message = "403 — cookie/session likely expired";
    }
  } else if (httpStatus === 429) {
    category = "RATE_LIMIT";
    retryable = true;
    message = "429 — rate limited by Ticketmaster";
  } else if (httpStatus && httpStatus >= 500 && httpStatus <= 599) {
    category = "UPSTREAM_ERROR";
    retryable = true;
    message = `${httpStatus} — Ticketmaster upstream failure`;
  } else if (errorCode === "ECONNABORTED") {
    category = "TIMEOUT";
    retryable = true;
    message = `Request timed out (${err.message})`;
  } else if (
    [
      "EHOSTUNREACH",
      "ECONNREFUSED",
      "ENOTFOUND",
      "ECONNRESET",
      "ENETUNREACH",
      "EPIPE",
    ].includes(errorCode)
  ) {
    category = "NETWORK_ERROR";
    retryable = true;
    message = `${errorCode} — ${err.message}`;
  } else if (httpStatus) {
    // Other HTTP errors (4xx, unexpected codes, etc.)
    message = `HTTP ${httpStatus} — ${err.message}`;
  }

  return { category, httpStatus, message, errorCode, responseBody, retryable };
}
