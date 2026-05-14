import axios from "axios";
import { normalizeError } from "../utils/normalizeError.js";
import { sortManifestSections } from "../utils/classifyManifestSection.js";

const TM_CH_COOKIE = process.env.TM_CH_COOKIE || "";

const headersCH = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.ch/",
  Origin: "https://www.ticketmaster.ch",
  Cookie: TM_CH_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster CH event and extracts
 * section code + name pairs (sections preferred over levels).
 */
export async function fetchCHManifestSections({ eventId, domain = "ch" }) {
  const url = `https://availability.ticketmaster.${domain}/api/v2/TM_CH/manifest/${eventId}`;

  try {
    const res = await axios.get(url, { headers: headersCH, timeout: 10000 });
    const data = res.data;

    if (!data || typeof data !== "object") {
      return { success: false, error: "Manifest response missing expected object structure" };
    }

    const rawItems =
      Array.isArray(data.sections) && data.sections.length > 0
        ? data.sections
        : Array.isArray(data.levels)
          ? data.levels
          : [];

    if (rawItems.length === 0) {
      return { success: false, error: "Manifest response missing sections and levels arrays" };
    }

    const sections = rawItems
      .filter((s) => s.code && s.name)
      .map((s) => ({ code: s.code, name: s.name }));

    const sorted = sortManifestSections(sections);
    return { success: true, sections: sorted };
  } catch (err) {
    const normalized = normalizeError(err);
    return { success: false, error: `${normalized.category}: ${normalized.message}` };
  }
}
