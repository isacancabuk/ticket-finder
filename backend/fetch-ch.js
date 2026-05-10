import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";
import { getPriceMap } from "./src/services/priceMapFetcher.js";

const TM_CH_COOKIE = process.env.TM_CH_COOKIE || "";

if (!TM_CH_COOKIE) {
  console.warn(
    "[fetch-ch] WARNING: TM_CH_COOKIE is not set in .env — CH requests will fail."
  );
}

const headersCH = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.ch/",
  Origin: "https://www.ticketmaster.ch",
  Cookie: TM_CH_COOKIE,
};

/**
 * Checks if a sorted array of seat numbers contains at least `n` consecutive values.
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

/**
 * Flexible section key matching:
 *   - exact:  "GAL-C" === section
 *   - prefix: "GAL-C-..." starts with section + "-"
 *   - suffix: "...-GAL-C" ends with "-" + section
 */
function matchesSection(key, section) {
  return (
    key === section ||
    key.startsWith(`${section}-`) ||
    key.endsWith(`-${section}`)
  );
}

export async function fetchCH({ eventId, section, minSeats = 1, maxPrice }) {
  const url = `https://availability.ticketmaster.ch/api/v2/TM_CH/availability/${eventId}?subChannelId=1`;
  const start = Date.now();

  try {
    const res = await axios.get(url, { headers: headersCH, timeout: 10000 });
    const latencyMs = Date.now() - start;
    const data = res.data;

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

    const offersMap = {};
    if (Array.isArray(data.offers)) {
      for (const offer of data.offers) {
        if (offer.id && !offersMap[offer.id]) offersMap[offer.id] = offer;
      }
    }

    const priceMap = await getPriceMap(eventId, "ch", TM_CH_COOKIE);

    let isAvailable = false;
    let foundPrice = null;
    let priceExceeded = false;
    const isBroadMode = !section;
    let cheapestMatchingPrice = null;

    // ── Main loop: places-based groups ────────────────────────
    for (const g of data.groups) {
      const places = g.places || {};
      const offerIds = g.offerIds || [];

      const matchingKeys = isBroadMode
        ? Object.keys(places)
        : Object.keys(places).filter((k) => matchesSection(k, section));
      if (matchingKeys.length === 0) continue;

      let sectionHasEnoughSeats = false;
      for (const sectionKey of matchingKeys) {
        const rows = places[sectionKey];
        if (!rows) continue;
        if (minSeats <= 1) {
          const hasAnySeat = Object.values(rows).some(
            (seatsArr) => Array.isArray(seatsArr) && seatsArr.length > 0
          );
          if (hasAnySeat) { sectionHasEnoughSeats = true; break; }
        } else {
          for (const rowId of Object.keys(rows)) {
            const seats = (rows[rowId] || [])
              .map(Number)
              .filter((n) => !isNaN(n))
              .sort((a, b) => a - b);
            if (hasConsecutiveSeats(seats, minSeats)) {
              sectionHasEnoughSeats = true;
              break;
            }
          }
        }
        if (sectionHasEnoughSeats) break;
      }
      if (!sectionHasEnoughSeats) continue;

      if (offerIds.length > 0) {
        for (const offerId of offerIds) {
          const offer = offersMap[offerId];
          if (!offer) continue;
          if (offer.quantities && offer.quantities.length > 0) {
            if (!offer.quantities.some((q) => q >= minSeats)) continue;
          }
          let offerPrice = null;
          if (offer.price && offer.price.total != null) {
            offerPrice = offer.price.total;
          } else if (priceMap && offer.priceType && offer.priceLevel) {
            if (priceMap[offer.priceType]?.[offer.priceLevel] != null) {
              offerPrice = priceMap[offer.priceType][offer.priceLevel];
            }
          }
          if (offerPrice == null) continue;
          if (cheapestMatchingPrice === null || offerPrice < cheapestMatchingPrice) {
            cheapestMatchingPrice = offerPrice;
          }
          if (!maxPrice || offerPrice <= maxPrice) isAvailable = true;
        }
      } else {
        isAvailable = true;
      }
    }

    // ── Floor / GA fallback: sections-based groups ─────────────
    if (!isAvailable && cheapestMatchingPrice === null) {
      for (const g of data.groups) {
        const sections = g.sections || {};
        const offerIds = g.offerIds || [];

        const matchingKeys = isBroadMode
          ? Object.keys(sections)
          : Object.keys(sections).filter((k) => matchesSection(k, section));
        if (matchingKeys.length === 0) continue;

        if (offerIds.length > 0) {
          for (const offerId of offerIds) {
            const offer = offersMap[offerId];
            if (!offer) continue;
            let offerPrice = null;
            if (offer.price && offer.price.total != null) {
              offerPrice = offer.price.total;
            } else if (priceMap && offer.priceType && offer.priceLevel) {
              if (priceMap[offer.priceType]?.[offer.priceLevel] != null) {
                offerPrice = priceMap[offer.priceType][offer.priceLevel];
              }
            }
            if (offerPrice == null) {
              isAvailable = true;
              if (cheapestMatchingPrice === null) {
                cheapestMatchingPrice = -1;
              }
              continue;
            }
            if (cheapestMatchingPrice === null || cheapestMatchingPrice === -1 || offerPrice < cheapestMatchingPrice) {
              cheapestMatchingPrice = offerPrice;
            }
            if (!maxPrice || offerPrice <= maxPrice) isAvailable = true;
          }
        } else {
          isAvailable = true;
        }
      }
    }

    if (cheapestMatchingPrice !== null) {
      foundPrice = cheapestMatchingPrice;
      if (!isAvailable) priceExceeded = true;
    }

    return { success: true, isAvailable, foundPrice, priceExceeded, eventName: data?.event?.name, latencyMs };
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
