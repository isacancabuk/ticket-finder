import axios from "axios";

/**
 * Fetches the event page HTML and extracts structured metadata from LD+JSON.
 *
 * Called only during query creation — never by the scheduler.
 * Failure is non-fatal: returns nulls so query creation still succeeds.
 *
 * @param {string} eventUrl - Full Ticketmaster event URL
 * @returns {Promise<{ eventLocation: string|null, eventDate: string|null }>}
 */
export async function fetchEventMetadata(eventUrl) {
  const empty = { eventLocation: null, eventDate: null };

  if (!eventUrl) return empty;

  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      Accept: "text/html,application/xhtml+xml",
    };

    if (eventUrl.includes("ticketmaster.de")) {
      const tmDeCookie = process.env.TM_DE_COOKIE || "";
      if (tmDeCookie) {
         headers["Cookie"] = tmDeCookie;
         headers["Referer"] = "https://www.ticketmaster.de/";
         headers["Origin"] = "https://www.ticketmaster.de";
      }
    } else if (eventUrl.includes("ticketmaster.es")) {
      const tmEsCookie = process.env.TM_ES_COOKIE || "";
      if (tmEsCookie) {
         headers["Cookie"] = tmEsCookie;
         headers["Referer"] = "https://www.ticketmaster.es/";
         headers["Origin"] = "https://www.ticketmaster.es";
      }
    }

    const res = await axios.get(eventUrl, {
      timeout: 5000,
      headers,
      // We only need the HTML text, don't parse as JSON
      responseType: "text",
    });

    const html = typeof res.data === "string" ? res.data : "";

    // Extract all LD+JSON script blocks
    const ldJsonRegex =
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

    let match;
    while ((match = ldJsonRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);

        // Look for an object whose @type contains "Event"
        // Covers MusicEvent, SportsEvent, Event, etc.
        const type = json["@type"] || "";
        if (!type.toLowerCase().includes("event")) continue;

        // Extract location — prefer addressLocality, fallback to location.name
        let eventLocation = null;
        if (json.location) {
          const addr = json.location.address;
          if (addr?.addressLocality) {
            eventLocation = addr.addressLocality;
          } else if (json.location.name) {
            eventLocation = json.location.name;
          }
        }

        // Extract date — take only the date portion of startDate
        let eventDate = null;
        if (json.startDate) {
          // "2026-06-11T18:00:00" → "2026-06-11"
          eventDate = json.startDate.split("T")[0];
        }

        return { eventLocation, eventDate };
      } catch {
        // JSON parse failed for this block — try next one
        continue;
      }
    }

    // No matching LD+JSON found
    return empty;
  } catch (err) {
    // Only log if it's a structural error or 5xx, ignore 401/403 anti-bot walls
    const status = err.response?.status;
    if (status !== 401 && status !== 403) {
      console.warn(
        `[fetchEventMetadata] Failed to fetch metadata from ${eventUrl}: ${err.message}`
      );
    }
    return empty;
  }
}

