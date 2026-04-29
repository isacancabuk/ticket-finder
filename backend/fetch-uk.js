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
const PAGE_SIZE = 20;       // Assumed from observed offset deltas (180→200)
const MAX_PAGES = 10;       // Safety cap → max ~200 tickets scanned
const BASE_DELAY_MS = 250;  // Base inter-page delay
const JITTER_MS = 250;      // Random jitter added to base delay (0..JITTER_MS)

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
 * Anti-bot-friendly pagination strategy:
 * - Jittered delay (250–500ms) between page requests
 * - MAX_PAGES = 10 (max ~200 tickets)
 * - Early exit as soon as a valid section+price match is found
 * - Partial success: if mid-stream pages get blocked (403), evaluates
 *   already-collected data instead of discarding everything
 *
 * Both `picks` and `promoted` arrays from each response are merged
 * and deduplicated by pick.id.
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

  // ── Matching state (maintained across pages) ────────────────
  let isAvailable = false;
  let cheapestMatchingPrice = null;
  const isBroadMode = !section;

  // ── Accumulation state ──────────────────────────────────────
  const seenIds = new Set();
  let totalFromApi = null;
  let offset = 0;
  let firstPageValidated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    // ── Inter-page delay (skip page 0) ──────────────────────
    if (page > 0) {
      const delay = BASE_DELAY_MS + Math.floor(Math.random() * JITTER_MS);
      await new Promise((r) => setTimeout(r, delay));
    }

    const url = buildQuickpicksUrl(eventId, qty, offset);
    let data;

    try {
      const res = await axios.get(url, {
        headers: headersUK,
        timeout: 10000,
      });
      data = res.data;
    } catch (err) {
      // ── Partial success: mid-stream error handling ────────
      // If we have NO data yet (page 0 failed) → full error
      if (!firstPageValidated) {
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

      // We have data from previous pages → break and evaluate
      console.warn(
        `[fetch-uk] Page ${page} blocked (offset=${offset}), evaluating ${seenIds.size} picks from previous pages`
      );
      break;
    }

    // ── First-page structure validation ─────────────────────
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
          httpStatus: 200,
          responseBody: bodySnippet,
          retryable: false,
          latencyMs,
        };
      }
      totalFromApi = typeof data.total === "number" ? data.total : null;
      firstPageValidated = true;
    }

    // ── Merge picks + promoted (deduplicated) ───────────────
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

      if (seenIds.has(id)) continue;
      seenIds.add(id);
      newCount++;

      // ── Per-pick matching (inline) ──────────────────────
      // Section match
      if (!isBroadMode) {
        if (
          !pick.section ||
          pick.section.toUpperCase() !== section.toUpperCase()
        ) {
          continue;
        }
      }

      // Price evaluation
      const rawPrice = pick.originalPrice;
      if (rawPrice == null) continue;

      const priceCents = Math.round(rawPrice * 100);

      // Track cheapest matching price
      if (cheapestMatchingPrice === null || priceCents < cheapestMatchingPrice) {
        cheapestMatchingPrice = priceCents;
      }

      // Price check against maxPrice
      if (!maxPrice || priceCents <= maxPrice) {
        isAvailable = true;
      }
    }

    // ── Early exit: valid match found ────────────────────────
    if (isAvailable) break;

    // Stop condition 2: all duplicates — server recycling results
    if (newCount === 0) break;

    // Stop condition 3: total reached — full dataset accumulated
    if (totalFromApi != null && seenIds.size >= totalFromApi) break;

    offset += PAGE_SIZE;
  }

  const latencyMs = Date.now() - start;

  // ── Determine final result ──────────────────────────────────
  let foundPrice = null;
  let priceExceeded = false;

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
}
