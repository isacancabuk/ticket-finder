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

// ── Pagination constants ──────────────────────────────────────
const PAGE_SIZE = 20;   // Assumed from observed offset deltas (180→200)
const MAX_PAGES = 50;   // Safety cap → max ~1000 tickets scanned

/**
 * Builds the quickpicks URL with pagination support.
 * @param {string} eventId
 * @param {number} qty
 * @param {number} offset
 * @returns {string}
 */
function buildQuickpicksUrl(eventId, qty, offset) {
  const params = new URLSearchParams({
    sort: "price",
    offset: String(offset),
    qty: String(qty),
    defaultToOne: "true",
    promoted: "primary",
    primary: "true",
    resale: "true",
  });
  return `https://www.ticketmaster.co.uk/api/quickpicks/${eventId}/list?${params}`;
}

/**
 * Checks ticket availability on Ticketmaster UK via the paginated quickpicks API.
 *
 * Fetches all pages of results by incrementing the offset parameter until
 * a safe stop condition is met (empty page, all duplicates, total reached,
 * or max page cap). Both `picks` and `promoted` arrays from each response
 * are merged and deduplicated by pick.id.
 *
 * Matching logic:
 * - Section matching is done against pick.section (case-insensitive)
 * - Price comes from originalPrice (per-ticket price in GBP)
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
  const start = Date.now();

  try {
    // ── Paginated accumulation ────────────────────────────────
    const allPicks = [];
    const seenIds = new Set();
    let totalFromApi = null;
    let offset = 0;
    let firstPageValidated = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = buildQuickpicksUrl(eventId, qty, offset);

      const res = await axios.get(url, {
        headers: headersUK,
        timeout: 10000,
      });

      const data = res.data;

      // ── First-page structure validation ───────────────────
      if (!firstPageValidated) {
        if (!data || typeof data !== "object" || !Array.isArray(data.picks)) {
          const latencyMs = Date.now() - start;
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
        totalFromApi = typeof data.total === "number" ? data.total : null;
        firstPageValidated = true;
      }

      // ── Merge picks + promoted (deduplicated) ─────────────
      const pagePicks = [
        ...(Array.isArray(data.picks) ? data.picks : []),
        ...(Array.isArray(data.promoted) ? data.promoted : []),
      ];

      // Stop condition 1: empty page
      if (pagePicks.length === 0) break;

      let newCount = 0;
      for (const pick of pagePicks) {
        // Unique ID: prefer pick.id, fallback to resaleListingId, then composite key
        const id =
          pick.id ||
          pick.resaleListingId ||
          `${pick.section}-${pick.row}-${pick.seatFrom}`;

        if (!seenIds.has(id)) {
          seenIds.add(id);
          allPicks.push(pick);
          newCount++;
        }
      }

      // Stop condition 2: all duplicates — server recycling results
      if (newCount === 0) break;

      // Stop condition 3: total reached — full dataset accumulated
      if (totalFromApi != null && allPicks.length >= totalFromApi) break;

      offset += PAGE_SIZE;
    }

    const latencyMs = Date.now() - start;

    // ── Section + Price matching against full set ──────────────
    let isAvailable = false;
    let foundPrice = null;
    let priceExceeded = false;

    // Broad mode: when section is null, match ANY pick
    const isBroadMode = !section;

    // Track the cheapest matching price across all picks
    let cheapestMatchingPrice = null;

    for (const pick of allPicks) {
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
