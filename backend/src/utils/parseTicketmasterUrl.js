/**
 * Parses a Ticketmaster event URL and extracts domain, eventId, eventSlug, and eventName.
 *
 * @param {string} url - Full Ticketmaster event URL
 * @returns {{ site: "TICKETMASTER", domain: "DE"|"UK"|"ES"|"NL"|"PL", eventId: string, eventSlug: string|null, eventName: string|null, eventUrl: string }}
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

  // ── FIFA URL handling ──────────────────────────────────────
  // Pattern: fwc26-{shop|resale}-{currency}.tickets.fifa.com/secure/selection/event/seat/performance/{perfId}/lang/en
  const fifaMatch = hostname.match(
    /^fwc26-(shop|resale)-(\w+)\.tickets\.fifa\.com$/,
  );
  if (fifaMatch) {
    const variant = fifaMatch[1]; // "shop" or "resale"
    const currency = fifaMatch[2].toUpperCase(); // e.g. "USD", "EUR"
    const segments = parsed.pathname.split("/").filter(Boolean);

    // Find perfId: it's the segment after "performance"
    const perfIdx = segments.indexOf("performance");
    let eventId = null;
    if (perfIdx !== -1 && perfIdx + 1 < segments.length) {
      eventId = segments[perfIdx + 1];
    }

    // Also check for product-based URLs: /secure/selection/event/date/product/{productId}/lang/en
    if (!eventId) {
      const prodIdx = segments.indexOf("product");
      if (prodIdx !== -1 && prodIdx + 1 < segments.length) {
        eventId = segments[prodIdx + 1];
      }
    }

    if (!eventId || !/^\d+$/.test(eventId)) {
      throw new Error(
        `FIFA URL must contain a numeric performance or product ID, got: "${eventId}"`,
      );
    }

    return {
      site: "FIFA",
      domain: "FIFA",
      eventId,
      eventSlug: null,
      eventName: null,
      eventUrl: url,
      currency, // extra field for FIFA
      variant, // "shop" or "resale"
    };
  }

  // ── Ticketmaster URL handling ──────────────────────────────
  const domainMap = {
    "ticketmaster.de": "DE",
    "ticketmaster.co.uk": "UK",
    "ticketmaster.es": "ES",
    "ticketmaster.nl": "NL",
    "ticketmaster.pl": "PL",
    "ticketmaster.be": "BE",
    "ticketmaster.se": "SE",
    "ticketmaster.ch": "CH",
    "ticketmaster.com.mx": "MX",
  };

  const domain = domainMap[hostname];
  if (!domain) {
    throw new Error(
      `Unsupported domain: ${hostname}. Supported: Ticketmaster (${Object.keys(domainMap).join(", ")}), FIFA (fwc26-shop-*.tickets.fifa.com)`,
    );
  }

  // Extract path segments (filter out empty strings from leading/trailing slashes)
  const segments = parsed.pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    throw new Error("URL path has no segments — cannot extract event ID");
  }

  // eventId = last segment
  // DE/ES use numeric-only IDs; UK uses alphanumeric (hex) IDs
  const eventId = segments[segments.length - 1];
  if (domain === "UK" || domain === "MX") {
    if (!/^[A-Za-z0-9]+$/.test(eventId)) {
      throw new Error(
        `${domain} Event ID must be alphanumeric, got: "${eventId}"`,
      );
    }
  } else {
    if (!/^\d+$/.test(eventId)) {
      throw new Error(`Event ID must be numeric, got: "${eventId}"`);
    }
  }

  // eventSlug extraction:
  // DE/ES: /slug/{numericId}        → slug is segments[length - 2]
  // UK:    /slug/event/{alphaId}    → slug is segments[length - 3]
  let eventSlug = null;
  if ((domain === "UK" || domain === "MX") && segments.length >= 3) {
    eventSlug = decodeURIComponent(segments[segments.length - 3]);
  } else if (segments.length >= 2) {
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
