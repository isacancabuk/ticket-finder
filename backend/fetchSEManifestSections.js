import axios from "axios";
import { normalizeError } from "./src/utils/normalizeError.js";
import { sortManifestSections } from "./src/utils/classifyManifestSection.js";

const TM_SE_COOKIE = process.env.TM_SE_COOKIE || "";

const headersSE = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.ticketmaster.se/",
  Origin: "https://www.ticketmaster.se",
  Cookie: TM_SE_COOKIE,
};

/**
 * Fetches the manifest for a Ticketmaster SE event and extracts
 * section code + name pairs (sections preferred over levels).
 */
export async function fetchSEManifestSections({ eventId, domain = "se" }) {
  const url = `https://availability.ticketmaster.${domain}/api/v2/TM_SE/manifest/${eventId}`;

  try {
    const res = await axios.get(url, { headers: headersSE, timeout: 10000 });
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
