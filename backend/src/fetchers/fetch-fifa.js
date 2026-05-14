import { gotScraping } from "got-scraping";
import { readFile } from "fs/promises";

const MAX_COOKIE_AGE_MS = 30 * 60 * 1000; // 30 dakika

// Cache: aynı perfId için productId ve metadata tekrar çekilmesin
const metadataCache = new Map();

/**
 * Reads cookies from fifa-cookies.json and returns them as a Cookie header string.
 * Throws if the file is missing or cookies are too old.
 */
async function loadFifaCookies() {
  let raw;
  try {
    raw = await readFile("fifa-cookies.json", "utf-8");
  } catch {
    throw new Error("FIFA_COOKIE_MISSING: fifa-cookies.json dosyası bulunamadı. Lütfen puppeteer cookie harvester'ı çalıştırın.");
  }

  const cookieMap = JSON.parse(raw);
  const age = Date.now() - (cookieMap._harvestedAt || 0);

  if (age > MAX_COOKIE_AGE_MS) {
    throw new Error(`FIFA_COOKIE_EXPIRED: Çerezler ${Math.round(age / 60000)} dakika önce alınmış (max ${MAX_COOKIE_AGE_MS / 60000} dk). Tarayıcıyı kontrol edin.`);
  }

  return Object.entries(cookieMap)
    .filter(([k]) => k !== "_harvestedAt")
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Common headers for FIFA requests, mimicking a real Chrome browser.
 */
function buildHeaders(cookieString, perfId) {
  const referer = perfId
    ? `https://fwc26-shop-usd.tickets.fifa.com/secure/selection/event/seat/performance/${perfId}/lang/en`
    : "https://fwc26-shop-usd.tickets.fifa.com/";
  return {
    Cookie: cookieString,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7",
    Referer: referer,
    Origin: "https://fwc26-shop-usd.tickets.fifa.com",
    "X-Secutix-Host": "fwc26-shop-usd.tickets.fifa.com",
    "Sec-Ch-Ua":
      '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  };
}

/**
 * Fetches the HTML page for a given perfId and extracts:
 *  - productId (from product_description_header CSS class)
 *  - eventName (from team host/opposing spans)
 *  - eventDate (from og:title meta tag)
 */
async function fetchPageMetadata(perfId, cookieString, baseUrl) {
  // Check cache first
  if (metadataCache.has(perfId)) {
    return metadataCache.get(perfId);
  }

  const pageUrl = `${baseUrl}/secure/selection/event/seat/performance/${perfId}/lang/en`;

  const response = await gotScraping({
    url: pageUrl,
    headers: buildHeaders(cookieString, perfId),
    headerGeneratorOptions: {
      browsers: [{ name: "chrome", minVersion: 148, maxVersion: 148 }],
      operatingSystems: ["macos"],
    },
    timeout: { request: 15000 },
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `FIFA_PAGE_ERROR: Sayfa ${response.statusCode} döndürdü (perfId=${perfId})`,
    );
  }

  const body = response.body;

  // Extract productId from: product_description_header product_{id}
  const productMatch = body.match(
    /product_description_header\s+product_(\d+)/,
  );
  if (!productMatch) {
    throw new Error(
      "FIFA_PARSE_ERROR: productId sayfada bulunamadı. Oturum süresi dolmuş olabilir.",
    );
  }
  const productId = productMatch[1];

  // Extract event name from team host/opposing spans
  let eventName = null;
  const hostMatch = body.match(
    /<span class="team host">\s*([^<]+?)\s*(?:<img)/s,
  );
  // <img> is a void element (no </img>), opposing team name comes after <img ...> tag
  const opposingMatch = body.match(
    /class="team opposing">[\s\S]*?<img[^>]*>\s*([\s\S]*?)\s*<\/span>/,
  );

  if (hostMatch && opposingMatch) {
    const home = hostMatch[1].trim();
    const away = opposingMatch[1].trim();
    if (home && away) {
      eventName = `${home} vs ${away}`;
    }
  }

  if (!eventName) {
    // Fallback: try og:title
    const ogMatch = body.match(
      /<meta\s+property="og:title"\s+content="([^"]+)"/,
    );
    if (ogMatch) {
      eventName = ogMatch[1];
    }
  }

  // Extract event date from og:title: "Los Angeles Stadium | 12.06.2026 - 18:00 | FIFA World Cup 2026™"
  let eventDate = null;
  const ogTitleMatch = body.match(
    /<meta\s+property="og:title"\s+content="([^"]+)"/,
  );
  if (ogTitleMatch) {
    const parts = ogTitleMatch[1].split("|").map((s) => s.trim());
    if (parts.length >= 2) {
      eventDate = parts[1]; // e.g. "12.06.2026 - 18:00"
    }
  }

  // Extract event location from og:title
  let eventLocation = null;
  if (ogTitleMatch) {
    const parts = ogTitleMatch[1].split("|").map((s) => s.trim());
    if (parts.length >= 1) {
      eventLocation = parts[0]; // e.g. "Los Angeles Stadium"
    }
  }

  const metadata = { productId, eventName, eventDate, eventLocation };
  metadataCache.set(perfId, metadata);
  return metadata;
}

/**
 * Checks ticket availability on FIFA WC26 via the seatmap availability API.
 *
 * @param {object} opts
 * @param {string} opts.eventId - perfId from URL
 * @param {string|null} opts.section - Category name (EN) to match, null = any category
 * @param {number} opts.minSeats - Not used for FIFA (availability is category-level)
 * @param {number|null} opts.maxPrice - Max per-ticket price in cents (USD), null = no limit
 * @returns {Promise<object>}
 */
export async function fetchFIFA({ eventId, section, minSeats = 1, maxPrice }) {
  const start = Date.now();
  const perfId = eventId;

  let cookieString;
  try {
    cookieString = await loadFifaCookies();
  } catch (err) {
    return {
      success: false,
      errorMessage: err.message,
      errorCategory: err.message.startsWith("FIFA_COOKIE_")
        ? "AUTH_ERROR"
        : "UNKNOWN",
      retryable: true,
      latencyMs: Date.now() - start,
    };
  }

  // Determine base URL from cookies or default to USD
  const baseUrl = "https://fwc26-shop-usd.tickets.fifa.com";

  try {
    // Step 1: Get productId and metadata from the HTML page
    const { productId, eventName, eventDate } = await fetchPageMetadata(
      perfId,
      cookieString,
      baseUrl,
    );

    // Step 2: Call availability API
    const availUrl =
      `${baseUrl}/tnwr/v1/secure/seatmap/availability` +
      `?perfId=${perfId}&productId=${productId}` +
      `&isSeasonTicketMode=false&advantageId=&withPriceRange=true` +
      `&ppid=&reservationIdx=&crossSellId=&baseOperationIdsString=`;

    const availResponse = await gotScraping({
      url: availUrl,
      headers: {
        ...buildHeaders(cookieString, perfId),
        Accept: "application/json, text/plain, */*",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
      },
      headerGeneratorOptions: {
        browsers: [{ name: "chrome", minVersion: 148, maxVersion: 148 }],
        operatingSystems: ["macos"],
      },
      timeout: { request: 15000 },
    });

    if (availResponse.statusCode !== 200) {
      return {
        success: false,
        errorMessage: `FIFA_AVAIL_ERROR: Availability API ${availResponse.statusCode} döndürdü`,
        errorCategory: "HTTP_ERROR",
        httpStatus: availResponse.statusCode,
        retryable: availResponse.statusCode >= 500,
        latencyMs: Date.now() - start,
      };
    }

    let data;
    try {
      data = JSON.parse(availResponse.body);
    } catch {
      return {
        success: false,
        errorMessage: "FIFA_PARSE_ERROR: Availability API JSON parse edilemedi",
        errorCategory: "PARSING_ERROR",
        retryable: false,
        latencyMs: Date.now() - start,
      };
    }

    // Step 3: Process priceRangeCategories
    const categories = data.priceRangeCategories || [];
    const isBroadMode = !section;

    let isAvailable = false;
    let cheapestMatchingPrice = null;
    let priceExceeded = false;

    for (const cat of categories) {
      const catNameEN = cat.name?.en || "";

      // Section filtering: match category name (case-insensitive)
      if (!isBroadMode) {
        if (catNameEN.toLowerCase() !== section.toLowerCase()) {
          continue;
        }
      }

      // FIFA API returns prices in milli-units (1/1000 of currency unit)
      // e.g. 2735000 = $2,735.00 → convert to cents: 2735000 / 10 = 273500 cents
      const priceCents = cat.minPrice != null ? Math.round(cat.minPrice / 10) : null;
      if (priceCents == null) continue;

      // Track cheapest matching price
      if (cheapestMatchingPrice === null || priceCents < cheapestMatchingPrice) {
        cheapestMatchingPrice = priceCents;
      }

      // If a category exists with a price, tickets are available
      // (no need to check blocks/seats — category presence = availability)
      if (!maxPrice || priceCents <= maxPrice) {
        isAvailable = true;
      } else {
        priceExceeded = true;
      }
    }

    // If we found tickets at acceptable price, override priceExceeded
    if (isAvailable) {
      priceExceeded = false;
    }

    const latencyMs = Date.now() - start;

    return {
      success: true,
      isAvailable,
      foundPrice: cheapestMatchingPrice,
      priceExceeded: !isAvailable && priceExceeded,
      eventName,
      eventDate,
      latencyMs,
    };
  } catch (err) {
    // Clear cache on error (page might need re-fetch)
    metadataCache.delete(perfId);

    return {
      success: false,
      errorMessage: err.message,
      errorCategory: err.message.startsWith("FIFA_")
        ? "SCRAPING_ERROR"
        : "UNKNOWN",
      retryable: true,
      latencyMs: Date.now() - start,
    };
  }
}
