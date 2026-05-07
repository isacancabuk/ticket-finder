import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";
import { sortManifestSections } from "./src/utils/classifyManifestSection.js";

const TM_PL_COOKIE = process.env.TM_PL_COOKIE || "";

const headersPL = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.pl/",
  Origin: "https://www.ticketmaster.pl",
  Cookie: TM_PL_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster PL event and extracts
 * section code + name pairs.
 *
 * @param {object} opts
 * @param {string} opts.eventId - Numeric event ID
 * @param {string} [opts.domain="pl"] - TLD for the TM domain
 * @returns {Promise<{success: boolean, sections?: Array<{code: string, name: string}>, error?: string}>}
 */
export async function fetchPLManifestSections({ eventId, domain = "pl" }) {
  const url = `https://availability.ticketmaster.${domain}/api/v2/TM_PL/manifest/${eventId}`;

  try {
    const res = await axios.get(url, {
      headers: headersPL,
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

    const sections = rawItems
      .filter((s) => s.code && s.name)
      .map((s) => ({ code: s.code, name: s.name }));

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
