import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";
import { sortManifestSections } from "./src/utils/classifyManifestSection.js";

const TM_DE_COOKIE = process.env.TM_DE_COOKIE || "";

const headersDE = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.de/",
  Origin: "https://www.ticketmaster.de",
  Cookie: TM_DE_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster DE event and extracts
 * section code + name pairs.
 *
 * Sections are sorted by semantic priority:
 * 1. Floor/Standing/Special premium areas (e.g., Stehplatz)
 * 2. Other named special areas (e.g., Loge, Box, Club)
 * 3. Non-numeric codes
 * 4. Numeric seating sections (sorted numerically)
 * 5. Unknown items
 *
 * This prioritizes areas that are harder for users to guess manually.
 *
 * @param {object} opts
 * @param {string} opts.eventId - Numeric event ID
 * @param {string} [opts.domain="de"] - TLD for the TM domain (e.g. "de")
 * @returns {Promise<{success: boolean, sections?: Array<{code: string, name: string}>, error?: string}>}
 */
export async function fetchDEManifestSections({ eventId, domain = "de" }) {
  const url = `https://availability.ticketmaster.${domain}/api/v2/TM_DE/manifest/${eventId}`;

  try {
    const res = await axios.get(url, {
      headers: headersDE,
      timeout: 10000,
    });

    const data = res.data;

    if (!data || typeof data !== "object" || !Array.isArray(data.sections)) {
      return {
        success: false,
        error: "Manifest response missing expected sections array",
      };
    }

    // Extract code + name pairs
    const sections = data.sections
      .filter((s) => s.code && s.name)
      .map((s) => ({ code: s.code, name: s.name }));

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
