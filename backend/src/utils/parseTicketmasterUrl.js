/**
 * Parses a Ticketmaster event URL and extracts domain, eventId, eventSlug, and eventName.
 *
 * @param {string} url - Full Ticketmaster event URL
 * @returns {{ site: "TICKETMASTER", domain: "DE"|"UK"|"ES", eventId: string, eventSlug: string|null, eventName: string|null, eventUrl: string }}
 * @throws {Error} If the URL is invalid, unsupported, or missing a numeric event ID
 */

export function parseTicketmasterUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Normalize hostname: strip "www."
  const hostname = parsed.hostname.replace(/^www\./, "");

  // Detect domain from hostname
  const domainMap = {
    "ticketmaster.de": "DE",
    "ticketmaster.co.uk": "UK",
    "ticketmaster.es": "ES",
  };

  const domain = domainMap[hostname];
  if (!domain) {
    throw new Error(
      `Unsupported Ticketmaster domain: ${hostname}. Supported: ${Object.keys(domainMap).join(", ")}`
    );
  }

  // Extract path segments (filter out empty strings from leading/trailing slashes)
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    throw new Error("URL path has no segments — cannot extract event ID");
  }

  // eventId = last segment, must be numeric
  const eventId = segments[segments.length - 1];
  if (!/^\d+$/.test(eventId)) {
    throw new Error(`Event ID must be numeric, got: "${eventId}"`);
  }

  // eventSlug = second-to-last segment (if present), URI-decoded
  let eventSlug = null;
  if (segments.length >= 2) {
    eventSlug = decodeURIComponent(segments[segments.length - 2]);
  }

  // Derive eventName from slug
  let eventName = null;
  if (eventSlug) {
    eventName = eventSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\s+tickets\s*$/i, "")
      .trim();
  }

  // Since all supported domains are Ticketmaster
  const site = "TICKETMASTER";

  return {
    site,
    domain,
    eventId,
    eventSlug,
    eventName,
    eventUrl: url,
  };
}
