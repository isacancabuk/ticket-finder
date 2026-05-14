import { gotScraping } from "got-scraping";
import { readFile } from "fs/promises";

const MAX_COOKIE_AGE_MS = 30 * 60 * 1000;

/**
 * Reads cookies from fifa-cookies.json and returns a Cookie header string.
 */
async function loadFifaCookies() {
  let raw;
  try {
    raw = await readFile("fifa-cookies.json", "utf-8");
  } catch {
    throw new Error("fifa-cookies.json dosyası bulunamadı");
  }

  const cookieMap = JSON.parse(raw);
  const age = Date.now() - (cookieMap._harvestedAt || 0);

  if (age > MAX_COOKIE_AGE_MS) {
    throw new Error(
      `Çerezlerin süresi dolmuş (${Math.round(age / 60000)} dk)`,
    );
  }

  return Object.entries(cookieMap)
    .filter(([k]) => k !== "_harvestedAt")
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function buildHeaders(cookieString, perfId) {
  const referer = perfId
    ? `https://fwc26-shop-usd.tickets.fifa.com/secure/selection/event/seat/performance/${perfId}/lang/en`
    : "https://fwc26-shop-usd.tickets.fifa.com/";
  return {
    Cookie: cookieString,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7",
    Referer: referer,
    Origin: "https://fwc26-shop-usd.tickets.fifa.com",
    "X-Secutix-Host": "fwc26-shop-usd.tickets.fifa.com",
    "Sec-Ch-Ua":
      '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
  };
}

/**
 * Fetches the price range categories for a FIFA WC26 event and returns
 * section code + name pairs for the manifest sections helper.
 *
 * @param {object} opts
 * @param {string} opts.eventId - perfId from URL
 * @param {string} [opts.productId] - Optional productId. If not provided, fetches from HTML.
 * @returns {Promise<{ success: boolean, sections?: Array<{code: string, name: string}>, error?: string }>}
 */
export async function fetchFIFAManifestSections({ eventId, productId }) {
  const baseUrl = "https://fwc26-shop-usd.tickets.fifa.com";

  let cookieString;
  try {
    cookieString = await loadFifaCookies();
  } catch (err) {
    return { success: false, error: err.message };
  }

  try {
    // If productId not provided, fetch from HTML page
    let resolvedProductId = productId;
    if (!resolvedProductId) {
      const pageUrl = `${baseUrl}/secure/selection/event/seat/performance/${eventId}/lang/en`;
      const pageRes = await gotScraping({
        url: pageUrl,
        headers: {
          ...buildHeaders(cookieString, eventId),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
        },
        headerGeneratorOptions: {
          browsers: [{ name: "chrome", minVersion: 148, maxVersion: 148 }],
          operatingSystems: ["macos"],
        },
        timeout: { request: 15000 },
      });

      if (pageRes.statusCode !== 200) {
        return {
          success: false,
          error: `Sayfa ${pageRes.statusCode} döndürdü`,
        };
      }

      const match = pageRes.body.match(
        /product_description_header\s+product_(\d+)/,
      );
      if (!match) {
        return {
          success: false,
          error:
            "productId sayfada bulunamadı. Oturum süresi dolmuş olabilir.",
        };
      }
      resolvedProductId = match[1];
    }

    // Fetch availability API
    const availUrl =
      `${baseUrl}/tnwr/v1/secure/seatmap/availability` +
      `?perfId=${eventId}&productId=${resolvedProductId}` +
      `&isSeasonTicketMode=false&advantageId=&withPriceRange=true` +
      `&ppid=&reservationIdx=&crossSellId=&baseOperationIdsString=`;

    const availRes = await gotScraping({
      url: availUrl,
      headers: buildHeaders(cookieString, eventId),
      headerGeneratorOptions: {
        browsers: [{ name: "chrome", minVersion: 148, maxVersion: 148 }],
        operatingSystems: ["macos"],
      },
      timeout: { request: 15000 },
    });

    if (availRes.statusCode !== 200) {
      return {
        success: false,
        error: `Availability API ${availRes.statusCode} döndürdü`,
      };
    }

    let data;
    try {
      data = JSON.parse(availRes.body);
    } catch {
      return {
        success: false,
        error: "Availability API JSON parse edilemedi",
      };
    }

    const categories = data.priceRangeCategories || [];

    const sections = categories
      .filter((cat) => cat.name?.en)
      .map((cat) => ({
        code: cat.name.en,
        name: cat.name.en,
      }));

    return { success: true, sections };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
