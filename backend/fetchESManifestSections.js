import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";

const TM_ES_COOKIE = process.env.TM_ES_COOKIE || "";

const headersES = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.es/",
  Origin: "https://www.ticketmaster.es",
  Cookie: TM_ES_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster DE event and extracts
 * section code + name pairs.
 *
 * Sections are sorted so that string-based / non-numeric codes
 * (e.g. STR, STL, GCL, ET) appear first, followed by numeric codes
 * sorted numerically. This puts floor/GA entries near the top of
 * the list.
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

    const rawItems = (Array.isArray(data.sections) && data.sections.length > 0)
      ? data.sections
      : (Array.isArray(data.levels) ? data.levels : []);

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

    // Sort: non-numeric codes first, then numeric codes.
    // Within non-numeric: short codes (ET, GCL, GCR) first,
    // then Stehplatz (ST*), then Loge (L*).
    function sortGroup(code) {
      if (/^\d+$/.test(code)) return 3;       // numeric → last
      if (/^L\d/i.test(code)) return 2;       // Loge (L001…) → after Stehplatz
      if (/^ST/i.test(code)) return 1;        // Stehplatz (STL, STR) → after short codes
      return 0;                               // everything else (ET, GCL, GCR) → first
    }

    sections.sort((a, b) => {
      const gA = sortGroup(a.code);
      const gB = sortGroup(b.code);
      if (gA !== gB) return gA - gB;

      // Both numeric → sort numerically
      if (gA === 3) {
        return parseInt(a.code, 10) - parseInt(b.code, 10);
      }

      // Same group → alphabetically
      return a.code.localeCompare(b.code);
    });

    return { success: true, sections };
  } catch (err) {
    const normalized = normalizeError(err);
    return {
      success: false,
      error: `${normalized.category}: ${normalized.message}`,
    };
  }
}
