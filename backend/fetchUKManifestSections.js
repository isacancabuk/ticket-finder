import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";
import { sortManifestSections } from "./src/utils/classifyManifestSection.js";

const TM_UK_COOKIE = process.env.TM_UK_COOKIE || "";

const headersUK = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.co.uk/",
  Origin: "https://www.ticketmaster.co.uk",
  Cookie: TM_UK_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster UK event and extracts
 * section name pairs.
 *
 * UK manifest endpoint: https://pubapi.ticketmaster.co.uk/sdk/static/manifest/v1/{eventId}
 * Response shape: { manifestSections: [{ numSeats, name }, ...] }
 *
 * Since the UK manifest only provides `name` (no separate `code`),
 * we use the name as both code and display name.
 *
 * Sections are sorted using the shared semantic classification helper.
 *
 * @param {object} opts
 * @param {string} opts.eventId - Alphanumeric event ID
 * @returns {Promise<{success: boolean, sections?: Array<{code: string, name: string}>, error?: string}>}
 */
export async function fetchUKManifestSections({ eventId }) {
  const url = `https://pubapi.ticketmaster.co.uk/sdk/static/manifest/v1/${eventId}`;

  try {
    const res = await axios.get(url, {
      headers: headersUK,
      timeout: 10000,
    });

    const data = res.data;

    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.manifestSections)
    ) {
      return {
        success: false,
        error: "UK manifest response missing expected manifestSections array",
      };
    }

    // Extract code + name pairs
    // UK manifest only provides `name` — use it as both code and name
    const sections = data.manifestSections
      .filter((s) => s.name)
      .map((s) => ({ code: s.name, name: s.name }));

    // Sort using semantic classification helper
    const sorted = sortManifestSections(sections);

    return { success: true, sections: sorted };
  } catch (err) {
    const normalized = normalizeError(err);
    return {
      success: false,
      error: `${normalized.category}: ${normalized.message}`,
    };
  }
}
