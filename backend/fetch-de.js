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

export async function fetchDE({ eventId, section, minSeats = 1 }) {
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

    // ── Section availability check (with consecutive seat logic) ──
    let isAvailable = false;

    for (const g of data.groups) {
      const places = g.places || {};

      // Find all section keys that end with `-${section}` (e.g., U-105, M-105, UW-105)
      const matchingKeys = Object.keys(places).filter((k) => k.endsWith(`-${section}`));

      // Check all matching section keys (safely handles multiple formats)
      for (const sectionKey of matchingKeys) {
        const rows = places[sectionKey];
        if (!rows) continue;

        // If minSeats is 1, verify there is actually at least one seat present
        if (minSeats <= 1) {
          const hasAnySeat = Object.values(rows).some((seatsArr) => Array.isArray(seatsArr) && seatsArr.length > 0);
          if (hasAnySeat) {
            isAvailable = true;
            break;
          }
        } else {
          // Check each row for N consecutive seats
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

      if (isAvailable) break;
    }

    return {
      success: true,
      isAvailable,
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
