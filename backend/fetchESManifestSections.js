import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";
import { sortManifestSections } from "./src/utils/classifyManifestSection.js";

const TM_ES_COOKIE = process.env.TM_ES_COOKIE || "";

const headersES = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.es/",
  Origin: "https://www.ticketmaster.es",
  Cookie: TM_ES_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster ES event and extracts
 * section code + name pairs.
 *
 * Sections are sorted by semantic priority:
 * 1. Floor/Standing/Special premium areas (e.g., Pista General, Gold Circle)
 * 2. Other named special areas (e.g., Loge, Box, Club)
 * 3. Non-numeric codes
 * 4. Numeric seating sections (sorted numerically)
 * 5. Unknown items
 *
 * This works cross-domain by considering both code and name semantics,
 * prioritizing areas that are harder for users to guess manually.
 *
 * @param {object} opts
 * @param {string} opts.eventId - Numeric event ID
 * @param {string} [opts.domain="es"] - TLD for the TM domain (e.g. "es")
 * @returns {Promise<{success: boolean, sections?: Array<{code: string, name: string}>, error?: string}>}
 */
export async function fetchESManifestSections({ eventId, domain = "es" }) {
  const url = `https://availability.ticketmaster.${domain}/api/v2/TM_ES/manifest/${eventId}`;

  try {
    const res = await axios.get(url, {
      headers: headersES,
      timeout: 10000,
    });

    const data = res.data;

    if (!data || typeof data !== "object") {
      return {
        success: false,
        error: "Manifest response missing expected object structure",
      };
    }

    const rawItems =
      Array.isArray(data.sections) && data.sections.length > 0
        ? data.sections
        : Array.isArray(data.levels)
          ? data.levels
          : [];

    if (rawItems.length === 0) {
      return {
        success: false,
        error: "Manifest response missing sections and levels arrays",
      };
    }

    // Extract code + name pairs
    const sections = rawItems
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
