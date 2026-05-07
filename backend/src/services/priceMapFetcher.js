import axios from "axios";

// Map to store eventId -> price map
const priceCache = new Map();

/**
 * Fetches the event page HTML, extracts __NEXT_DATA__, and parses the price map.
 * Returns a dictionary mapping priceType -> priceLevel -> priceInCents.
 */
export async function getPriceMap(eventId, domain, cookie) {
  if (priceCache.has(eventId)) {
    return priceCache.get(eventId);
  }

  const url = `https://www.ticketmaster.${domain}/event/${eventId}`;
  
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        Cookie: cookie || "",
      },
      timeout: 10000,
    });

    const html = res.data;
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    
    if (!nextDataMatch || !nextDataMatch[1]) {
      console.warn(`[priceMapFetcher] Could not find __NEXT_DATA__ for event ${eventId}`);
      return null;
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    
    // Ticketmaster uses different state structures for different events/domains
    const offerTypes = 
      nextData?.props?.pageProps?.initialState?.event?.offerTypes || 
      nextData?.props?.pageProps?.initialReduxState?.ticketSelection?.ticketTypes;

    if (!offerTypes || !Array.isArray(offerTypes)) {
      console.warn(`[priceMapFetcher] offerTypes or ticketTypes not found in __NEXT_DATA__ for event ${eventId}`);
      return null;
    }

    const priceMap = {};

    for (const offer of offerTypes) {
      const priceType = offer.id;
      if (!priceMap[priceType]) {
        priceMap[priceType] = {};
      }

      if (Array.isArray(offer.prices)) {
        for (const price of offer.prices) {
          const priceLevel = price.id;
          const faceValue = parseFloat(price.faceValue || 0);
          const serviceFee = parseFloat(price.serviceFeeChargesValue || 0);
          
          // Calculate total price in cents
          const totalCents = Math.round((faceValue + serviceFee) * 100);
          
          priceMap[priceType][priceLevel] = totalCents;
        }
      }
    }

    priceCache.set(eventId, priceMap);
    console.log(`[priceMapFetcher] Cached price map for event ${eventId}`);
    return priceMap;

  } catch (err) {
    console.warn(`[priceMapFetcher] Failed to fetch or parse HTML for event ${eventId}: ${err.message}`);
    return null;
  }
}
