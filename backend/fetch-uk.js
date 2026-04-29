import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";

const TM_UK_COOKIE = process.env.TM_UK_COOKIE || "";

if (!TM_UK_COOKIE) {
  console.warn(
    "[fetch-uk] WARNING: TM_UK_COOKIE is not set in .env — UK requests will fail."
  );
}

const headersUK = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.co.uk/",
  Origin: "https://www.ticketmaster.co.uk",
  Cookie: TM_UK_COOKIE,
};

/**
 * Checks ticket availability on Ticketmaster UK via the quickpicks API.
 *
 * Response shape: { quantity, eventId, total, picks: [...] }
 * Each pick: { section, row, seatFrom, seatTo, originalPrice, ... }
 *
 * Matching logic:
 * - Section matching is done against pick.section
 * - Price comes from originalPrice (per-ticket price)
 * - qty is set to minSeats; the API returns results compatible with the requested seat count
 *
 * @param {object} opts
 * @param {string} opts.eventId - Alphanumeric event ID
 * @param {string|null} opts.section - Target section (null = broad mode)
 * @param {number} opts.minSeats - Minimum seats desired (used as qty parameter)
 * @param {number|null} opts.maxPrice - Max per-ticket price in cents (null = no limit)
 * @returns {Promise<object>} - Result with isAvailable, foundPrice, priceExceeded, etc.
 */
export async function fetchUK({ eventId, section, minSeats = 1, maxPrice }) {
  const qty = minSeats || 1;
  const url = `https://www.ticketmaster.co.uk/api/quickpicks/${eventId}/list?defaultToOne=true&promoted=primary&primary=true&resale=true&qty=${qty}`;

  const start = Date.now();

  try {
    const res = await axios.get(url, {
      headers: headersUK,
      timeout: 10000,
    });

    const latencyMs = Date.now() - start;
    const data = res.data;

    // ── Response shape validation ──────────────────────────────
    if (!data || typeof data !== "object" || !Array.isArray(data.picks)) {
      const bodySnippet =
        typeof data === "string"
          ? data.slice(0, 500)
          : JSON.stringify(data).slice(0, 500);

      return {
        success: false,
        errorMessage: "PARSING_ERROR: response missing expected 'picks' array",
        errorCategory: "PARSING_ERROR",
        httpStatus: res.status,
        responseBody: bodySnippet,
        retryable: false,
        latencyMs,
      };
    }

    // ── Section + Price matching ───────────────────────────────
    let isAvailable = false;
    let foundPrice = null;
    let priceExceeded = false;

    // Broad mode: when section is null, match ANY pick
    const isBroadMode = !section;

    // Track the cheapest matching price across all picks
    let cheapestMatchingPrice = null;

    for (const pick of data.picks) {
      // Stage 1: Section match
      if (!isBroadMode) {
        // Compare pick.section against the target section (case-insensitive)
        if (
          !pick.section ||
          pick.section.toUpperCase() !== section.toUpperCase()
        ) {
          continue;
        }
      }

      // Stage 2: Price evaluation
      // originalPrice is per-ticket in GBP (as a float, e.g. 52.88)
      // Convert to cents for consistency with DE/ES
      const rawPrice = pick.originalPrice;
      if (rawPrice == null) continue;

      const priceCents = Math.round(rawPrice * 100);

      // Track cheapest matching price
      if (cheapestMatchingPrice === null || priceCents < cheapestMatchingPrice) {
        cheapestMatchingPrice = priceCents;
      }

      // Stage 3: Price check against maxPrice
      if (!maxPrice || priceCents <= maxPrice) {
        isAvailable = true;
        // Keep looking for cheaper options
      }
    }

    // Determine final price result
    if (cheapestMatchingPrice !== null) {
      foundPrice = cheapestMatchingPrice;
      if (!isAvailable) {
        // Section matched but all prices exceeded maxPrice
        priceExceeded = true;
      }
    }

    return {
      success: true,
      isAvailable,
      foundPrice,
      priceExceeded,
      eventName: null, // UK quickpicks API does not return event name
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const normalized = normalizeError(err);

    return {
      success: false,
      errorMessage: `${normalized.category}: ${normalized.message}`,
      errorCategory: normalized.category,
      httpStatus: normalized.httpStatus,
      responseBody: normalized.responseBody,
      retryable: normalized.retryable,
      latencyMs,
    };
  }
}
