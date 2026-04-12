import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";

const TM_DE_COOKIE = process.env.TM_DE_COOKIE || "";

if (!TM_DE_COOKIE) {
  console.warn(
    "[fetch-de] WARNING: TM_DE_COOKIE is not set in .env — DE requests will fail."
  );
}

const headersDE = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.de/",
  Origin: "https://www.ticketmaster.de",
  Cookie: TM_DE_COOKIE,
};

/**
 * Checks if a sorted array of seat numbers contains at least `n` consecutive values.
 * e.g. [14, 15, 16, 17, 18] with n=3 → true (14,15,16)
 */
function hasConsecutiveSeats(sortedSeats, n) {
  if (sortedSeats.length < n) return false;

  let run = 1;
  for (let i = 1; i < sortedSeats.length; i++) {
    if (sortedSeats[i] === sortedSeats[i - 1] + 1) {
      run++;
      if (run >= n) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

export async function fetchDE({ eventId, section, minSeats = 1, maxPrice }) {
  const url = `https://availability.ticketmaster.de/api/v2/TM_DE/availability/${eventId}?subChannelId=1`;

  const start = Date.now();

  try {
    const res = await axios.get(url, {
      headers: headersDE,
      timeout: 10000,
    });

    const latencyMs = Date.now() - start;
    const data = res.data;

    // ── Response shape validation ──────────────────────────────
    if (!data || typeof data !== "object" || !Array.isArray(data.groups)) {
      const bodySnippet =
        typeof data === "string"
          ? data.slice(0, 500)
          : JSON.stringify(data).slice(0, 500);

      return {
        success: false,
        errorMessage: "PARSING_ERROR: response missing expected structure",
        errorCategory: "PARSING_ERROR",
        httpStatus: res.status,
        responseBody: bodySnippet,
        retryable: false,
        latencyMs,
      };
    }

    // ── Build offers lookup map ────────────────────────────────
    const offersMap = {};
    if (Array.isArray(data.offers)) {
      for (const offer of data.offers) {
        if (offer.id) {
          offersMap[offer.id] = offer;
        }
      }
    }

    // ── Three-stage matching: section → seats → price ─────────
    let isAvailable = false;
    let foundPrice = null;
    let priceExceeded = false;

    // Track the cheapest matching price across all groups
    let cheapestMatchingPrice = null;

    for (const g of data.groups) {
      const places = g.places || {};
      const offerIds = g.offerIds || [];

      // Stage 1: Section match — find section keys ending with `-${section}`
      const matchingKeys = Object.keys(places).filter((k) => k.endsWith(`-${section}`));
      if (matchingKeys.length === 0) continue;

      // Check if this group's section has any actual seats
      let sectionHasSeats = false;
      for (const sectionKey of matchingKeys) {
        const rows = places[sectionKey];
        if (!rows) continue;
        const hasAnySeat = Object.values(rows).some(
          (seatsArr) => Array.isArray(seatsArr) && seatsArr.length > 0
        );
        if (hasAnySeat) {
          sectionHasSeats = true;
          break;
        }
      }
      if (!sectionHasSeats) continue;

      // Stage 2 & 3: Try offer-based matching first (has price info)
      if (offerIds.length > 0) {
        for (const offerId of offerIds) {
          const offer = offersMap[offerId];
          if (!offer) continue;

          // Stage 2: Seat count check via quantities
          const quantities = offer.quantities || [];
          const seatsMatch = quantities.some((q) => q >= minSeats);
          if (!seatsMatch) continue;

          // We have section + seats — now check price
          const offerPrice = offer.price?.total;
          if (offerPrice == null) continue;

          // Track cheapest price that matches section + seats
          if (cheapestMatchingPrice === null || offerPrice < cheapestMatchingPrice) {
            cheapestMatchingPrice = offerPrice;
          }

          // Stage 3: Price check
          if (!maxPrice || offerPrice <= maxPrice) {
            isAvailable = true;
            // Keep looking for even cheaper, but we already have a match
          }
        }
      } else {
        // Fallback: groups without offerIds — use legacy consecutive seat check
        // These don't have price info, so skip price evaluation
        for (const sectionKey of matchingKeys) {
          const rows = places[sectionKey];
          if (!rows) continue;

          if (minSeats <= 1) {
            const hasAnySeat = Object.values(rows).some(
              (seatsArr) => Array.isArray(seatsArr) && seatsArr.length > 0
            );
            if (hasAnySeat) {
              isAvailable = true;
              break;
            }
          } else {
            for (const rowId of Object.keys(rows)) {
              const seats = (rows[rowId] || [])
                .map(Number)
                .filter((n) => !isNaN(n))
                .sort((a, b) => a - b);

              if (hasConsecutiveSeats(seats, minSeats)) {
                isAvailable = true;
                break;
              }
            }
          }
          if (isAvailable) break;
        }
      }

      if (isAvailable) break;
    }

    // Determine final price result
    if (cheapestMatchingPrice !== null) {
      foundPrice = cheapestMatchingPrice;
      if (!isAvailable) {
        // Section + seats matched but all prices exceeded maxPrice
        priceExceeded = true;
      }
    }

    return {
      success: true,
      isAvailable,
      foundPrice,
      priceExceeded,
      eventName: data?.event?.name,
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
