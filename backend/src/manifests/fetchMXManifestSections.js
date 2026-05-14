import axios from "axios";
import { normalizeError } from "../utils/normalizeError.js";
import { sortManifestSections } from "../utils/classifyManifestSection.js";

const TM_MX_COOKIE = process.env.TM_MX_COOKIE || "";

const headersMX = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.com.mx/",
  Origin: "https://www.ticketmaster.com.mx",
  Cookie: TM_MX_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster MX event and extracts
 * section code + name pairs.
 */
export async function fetchMXManifestSections({ eventId }) {
  const url = `https://pubapi.ticketmaster.com.mx/sdk/static/manifest/v1/${eventId}`;

  try {
    const res = await axios.get(url, { headers: headersMX, timeout: 10000 });
    const data = res.data;

    if (
      !data ||
      typeof data !== "object" ||
      !Array.isArray(data.manifestSections)
    ) {
      return {
        success: false,
        error: "MX manifest response missing expected manifestSections array",
      };
    }

    const sections = data.manifestSections
      .filter((s) => s.name)
      .map((s) => ({ code: s.name, name: s.name }));

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
