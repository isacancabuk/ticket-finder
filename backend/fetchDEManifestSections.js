import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";

const TM_DE_COOKIE = process.env.TM_DE_COOKIE || "";

const headersDE = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.de/",
  Origin: "https://www.ticketmaster.de",
  Cookie: TM_DE_COOKIE,
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
