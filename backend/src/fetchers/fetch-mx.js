import axios from "axios";
import { normalizeError } from "../utils/normalizeError.js";

const TM_MX_COOKIE = process.env.TM_MX_COOKIE || "";

if (!TM_MX_COOKIE) {
  console.warn(
    "[fetch-mx] WARNING: TM_MX_COOKIE is not set in .env — MX requests will fail.",
  );
}

const headersMX = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.com.mx/",
  Origin: "https://www.ticketmaster.com.mx",
  Cookie: TM_MX_COOKIE,
};

// ── Pagination constants ──────────────────────────────────────
const PAGE_SIZE = 20; // Assumed from observed offset deltas
const MAX_PAGES = 50; // Safety cap
const BASE_DELAY_MS = 30000; // Base inter-page delay
const JITTER_MS = 10000; // Random jitter added to base delay

/**
 * Builds the quickpicks URL with pagination support for MX.
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
    primary: "true",
    resale: "true",
  });
  return `https://www.ticketmaster.com.mx/api/quickpicks/${eventId}/list?${params}`;
}

/**
 * Checks ticket availability on Ticketmaster MX via the paginated quickpicks API.
 * Uses exact logic as UK scraper.
 *
 * @param {object} opts
 * @param {string} opts.eventId - Alphanumeric event ID
 * @param {string|null} opts.section - Target section (null = broad mode)
 * @param {number} opts.minSeats - Minimum seats desired
 * @param {number|null} opts.maxPrice - Max per-ticket price in cents
 * @returns {Promise<object>}
 */
export async function fetchMX({ eventId, section, minSeats = 1, maxPrice }) {
  const qty = minSeats || 1;
  const start = Date.now();

  let isAvailable = false;
  let cheapestMatchingPrice = null;
  const isBroadMode = !section;
  let sectionFoundWithValidPrice = false;

  const seenIds = new Set();
  let totalFromApi = null;
  let offset = 0;
  let firstPageValidated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (page > 0) {
      const delay = BASE_DELAY_MS + Math.floor(Math.random() * JITTER_MS);
      await new Promise((r) => setTimeout(r, delay));
    }

    const url = buildQuickpicksUrl(eventId, qty, offset);
    let data;

    try {
      const res = await axios.get(url, {
        headers: headersMX,
        timeout: 10000,
      });
      data = res.data;
    } catch (err) {
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
      console.warn(
        `[fetch-mx] Page ${page} blocked (offset=${offset}), evaluating ${seenIds.size} picks from previous pages`,
      );
      break;
    }

    if (!firstPageValidated) {
      if (!data || typeof data !== "object" || !Array.isArray(data.picks)) {
        const latencyMs = Date.now() - start;
        const bodySnippet =
          typeof data === "string"
            ? data.slice(0, 500)
            : JSON.stringify(data).slice(0, 500);

        return {
          success: false,
          errorMessage:
            "PARSING_ERROR: response missing expected 'picks' array",
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

    const pagePicks = [
      ...(Array.isArray(data.picks) ? data.picks : []),
      ...(Array.isArray(data.promoted) ? data.promoted : []),
    ];

    if (pagePicks.length === 0) break;

    let newCount = 0;
    for (const pick of pagePicks) {
      const id =
        pick.id ||
        pick.resaleListingId ||
        `${pick.section}-${pick.row}-${pick.seatFrom}`;

      if (seenIds.has(id)) continue;
      seenIds.add(id);
      newCount++;

      if (!isBroadMode) {
        if (
          !pick.section ||
          pick.section.toUpperCase() !== section.toUpperCase()
        ) {
          continue;
        }
      }

      const rawPrice = pick.originalPrice;
      if (rawPrice == null) continue;

      const priceCents = Math.round(rawPrice * 100);

      if (
        cheapestMatchingPrice === null ||
        priceCents < cheapestMatchingPrice
      ) {
        cheapestMatchingPrice = priceCents;
      }

      if (!isBroadMode) {
        sectionFoundWithValidPrice = true;
      }

      if (!maxPrice || priceCents <= maxPrice) {
        isAvailable = true;
      }
    }

    if (sectionFoundWithValidPrice || (isBroadMode && isAvailable)) break;
    if (newCount === 0) break;
    if (totalFromApi != null && seenIds.size >= totalFromApi) break;

    offset += PAGE_SIZE;
  }

  const latencyMs = Date.now() - start;
  let foundPrice = null;
  let priceExceeded = false;

  if (cheapestMatchingPrice !== null) {
    foundPrice = cheapestMatchingPrice;
    if (!isAvailable) {
      priceExceeded = true;
    }
  }

  return {
    success: true,
    isAvailable,
    foundPrice,
    priceExceeded,
    eventName: null,
    latencyMs,
  };
}
