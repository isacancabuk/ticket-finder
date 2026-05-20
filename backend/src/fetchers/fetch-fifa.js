import { gotScraping } from "got-scraping";
import { readFile } from "fs/promises";

const MAX_COOKIE_AGE_MS = 30 * 60 * 1000; // 30 dakika

// Cache: aynı perfId için productId ve metadata tekrar çekilmesin
const metadataCache = new Map();

// ── Rate limiting & cooldown ─────────────────────────────────────────
const MIN_REQUEST_INTERVAL_MS = 15000; // İstekler arası minimum 15 saniye
const COOLDOWN_DURATION_MS = 45 * 1000; // 403 sonrası 45 saniye bekleme (was 120s)
let lastRequestTime = 0;
let cooldownUntil = 0;

// Metadata keys written by the harvester — must never appear in Cookie header
const COOKIE_METADATA_KEYS = new Set(["_harvestedAt", "_readinessChecks"]);

// SHA-256 of empty string — stx_advantage_ids uses this when no advantages are selected
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/**
 * Checks rate limit and cooldown. Returns a skip result instead of throwing
 * during cooldown so queries are not marked as ERROR.
 *
 * @returns {Promise<{ skip: boolean, skipReason?: string }>}
 */
async function waitForRateLimit() {
  const now = Date.now();

  // Cooldown kontrolü — 403 sonrası soft skip
  if (now < cooldownUntil) {
    const remainSec = Math.ceil((cooldownUntil - now) / 1000);
    console.log(
      `[FIFA] ⏭️ Cooldown active (${remainSec}s remaining) — skipping this tick`,
    );
    return {
      skip: true,
      skipReason: `FIFA_COOLDOWN: DataDome cooldown aktif (${remainSec}s kaldı)`,
    };
  }

  // Rate limit — istekler arası minimum bekleme
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitMs = MIN_REQUEST_INTERVAL_MS - elapsed;
    console.log(
      `[FIFA] ⏳ Rate limit: waiting ${Math.ceil(waitMs / 1000)}s before next request`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }

  lastRequestTime = Date.now();
  return { skip: false };
}

/**
 * Activates cooldown after a 403 response.
 */
function activateCooldown() {
  cooldownUntil = Date.now() + COOLDOWN_DURATION_MS;
  console.warn(
    `[FIFA] ⚠️ 403 detected — ${COOLDOWN_DURATION_MS / 1000}s cooldown started (until ${new Date(cooldownUntil).toLocaleTimeString()})`,
  );
}

/**
 * Validates that the resale cookie map contains all critical cookies
 * required for a working FIFA resale session.
 *
 * @param {object} cookieMap - key/value map of cookies
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateResaleCookies(cookieMap) {
  const missing = [];

  if (!cookieMap.datadome) missing.push("datadome");
  if (!cookieMap.STX_SESSION && !cookieMap.PKP_ID) missing.push("STX_SESSION/PKP_ID");
  if (!cookieMap.CACHE_PKP_TOKEN) missing.push("CACHE_PKP_TOKEN");

  const advIds = cookieMap.stx_advantage_ids;
  if (!advIds) {
    missing.push("stx_advantage_ids");
  } else if (advIds === EMPTY_SHA256) {
    missing.push("stx_advantage_ids (empty hash)");
  }

  // Check for AcpAT-*-Resale cookie
  const hasResaleAuth = Object.keys(cookieMap).some(
    (k) => k.startsWith("AcpAT") && k.includes("Resale"),
  );
  if (!hasResaleAuth) missing.push("AcpAT-*-Resale");

  return { valid: missing.length === 0, missing };
}

/**
 * Reads cookies from fifa-cookies.json for a specific variant.
 * Returns them as a Cookie header string.
 * Throws if the file is missing, variant doesn't exist, cookies are too old,
 * or critical session cookies are missing.
 *
 * @param {string} variant - "resale" (only supported variant)
 * @returns {Promise<string>} - Cookie header string (name=value; name=value; ...)
 */
async function loadFifaCookies(variant = "resale") {
  // Enforce resale-only
  if (variant !== "resale") {
    throw new Error(
      `FIFA_VARIANT_ERROR: Only "resale" variant is supported, got: "${variant}". FIFA is resale-only.`,
    );
  }

  let raw;
  try {
    raw = await readFile("fifa-cookies.json", "utf-8");
  } catch {
    throw new Error(
      "FIFA_COOKIE_MISSING: fifa-cookies.json dosyası bulunamadı. Lütfen puppeteer cookie harvester'ı çalıştırın.",
    );
  }

  // Safe JSON parse — handle corrupted or half-written files
  let allCookies;
  try {
    allCookies = JSON.parse(raw);
  } catch (parseErr) {
    throw new Error(
      `FIFA_COOKIE_CORRUPTED: fifa-cookies.json parse edilemedi (${parseErr.message}). Dosya yarım yazılmış olabilir.`,
    );
  }

  // Variant'a göre cookies'i al
  const variantCookies = allCookies[variant];
  if (!variantCookies || typeof variantCookies !== "object") {
    throw new Error(
      `FIFA_COOKIE_MISSING: "${variant}" variant'ı için çerez bulunamadı. fifa-cookies.json içinde ${Object.keys(allCookies).join(", ")} variant'ları var.`,
    );
  }

  // Age check
  const age = Date.now() - (variantCookies._harvestedAt || 0);
  if (age > MAX_COOKIE_AGE_MS) {
    throw new Error(
      `FIFA_COOKIE_EXPIRED: ${variant} çerezleri ${Math.round(age / 60000)} dakika önce alınmış (max ${MAX_COOKIE_AGE_MS / 60000} dk). Tarayıcıyı kontrol edin.`,
    );
  }

  // Validate critical cookies are present
  const { valid, missing } = validateResaleCookies(variantCookies);
  if (!valid) {
    console.error(
      `[FIFA] ❌ Cookie validation failed — missing critical cookies: ${missing.join(", ")}`,
    );
    throw new Error(
      `FIFA_COOKIE_INCOMPLETE: Resale session eksik — missing: ${missing.join(", ")}. Harvester çalışıyor mu kontrol edin.`,
    );
  }

  // Build cookie string — exclude metadata keys (never send as browser cookies)
  return Object.entries(variantCookies)
    .filter(([k]) => !COOKIE_METADATA_KEYS.has(k) && !k.startsWith("_"))
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Common headers for FIFA requests, mimicking a real Chrome browser.
 */
function buildHeaders(
  cookieString,
  perfId,
  baseUrl = "https://fwc26-resale-usd.tickets.fifa.com",
) {
  const referer = perfId
    ? `${baseUrl}/secure/selection/event/seat/performance/${perfId}/lang/en`
    : `${baseUrl}/`;
  const hostFromUrl = new URL(baseUrl).hostname;
  return {
    Cookie: cookieString,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8,tr;q=0.7",
    Referer: referer,
    Origin: baseUrl,
    "X-Secutix-Host": hostFromUrl,
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
    const cached = metadataCache.get(perfId);
    console.log(
      `[FIFA] ✅ Using cached metadata: productId=${cached.productId} eventName="${cached.eventName || "?"}"`,
    );
    return cached;
  }

  console.log(
    `[FIFA] 🔄 Phase: Fetching metadata page (perfId=${perfId})`,
  );

  const pageUrl = `${baseUrl}/secure/selection/event/seat/performance/${perfId}/lang/en`;

  let response;
  try {
    response = await gotScraping({
      url: pageUrl,
      headers: buildHeaders(cookieString, perfId, baseUrl),
      headerGeneratorOptions: {
        browsers: [{ name: "chrome", minVersion: 148, maxVersion: 148 }],
        operatingSystems: ["macos"],
      },
      timeout: { request: 15000 },
      maxRedirects: 3,
      followRedirect: true,
    });
  } catch (reqErr) {
    // Catch redirect loops and provide actionable error
    if (reqErr.message?.includes("Redirected") || reqErr.code === "ERR_TOO_MANY_REDIRECTS") {
      console.error(
        `[FIFA] ❌ Metadata page redirect loop detected (perfId=${perfId}). ` +
        `This usually means cookies are expired or were harvested from a different flow. ` +
        `Run the cookie harvester to get fresh resale cookies.`,
      );
      throw new Error(
        `FIFA_PAGE_ERROR: Redirect loop — cookies likely expired or invalid. Harvester'ı yeniden çalıştırın.`,
      );
    }
    throw reqErr;
  }

  if (response.statusCode !== 200) {
    if (response.statusCode === 403) {
      activateCooldown();
    }
    console.error(
      `[FIFA] ❌ Metadata page failed: HTTP ${response.statusCode} (perfId=${perfId})`,
    );
    throw new Error(
      `FIFA_PAGE_ERROR: Sayfa ${response.statusCode} döndürdü (perfId=${perfId})`,
    );
  }

  const body = response.body;

  // Extract productId from: product_description_header product_{id}
  const productMatch = body.match(/product_description_header\s+product_(\d+)/);
  if (!productMatch) {
    console.error(
      `[FIFA] ❌ Metadata parse failed: productId not found in page HTML (perfId=${perfId})`,
    );
    throw new Error(
      "FIFA_PARSE_ERROR: productId sayfada bulunamadı. Oturum süresi dolmuş olabilir.",
    );
  }
  const productId = productMatch[1];

  // Extract metadata from schema.org JSON-LD (most reliable source)
  let eventName = null;
  let eventDate = null;
  let eventLocation = null;

  const ldJsonMatch = body.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (ldJsonMatch) {
    try {
      const schema = JSON.parse(ldJsonMatch[1]);

      // Event name: use "name" field (e.g. "USA vs. Paraguay")
      if (schema.name) {
        eventName = schema.name;
      }

      // Event date: use "startDate" (e.g. "2026-06-12T18:00:00Z")
      if (schema.startDate) {
        // Format: "12.06.2026 - 18:00" for UI consistency
        const d = new Date(schema.startDate);
        const day = String(d.getUTCDate()).padStart(2, "0");
        const month = String(d.getUTCMonth() + 1).padStart(2, "0");
        const year = d.getUTCFullYear();
        const hours = String(d.getUTCHours()).padStart(2, "0");
        const mins = String(d.getUTCMinutes()).padStart(2, "0");
        eventDate = `${day}.${month}.${year} - ${hours}:${mins}`;
      }

      // Event location: use "location.name" (e.g. "Los Angeles Stadium")
      if (schema.location?.name) {
        eventLocation = schema.location.name;
      }
    } catch {
      // JSON parse failed — fall through to regex fallbacks
    }
  }

  // Fallback: regex-based extraction if JSON-LD didn't work
  if (!eventName) {
    const hostMatch = body.match(
      /<span class="team host">\s*([^<]+?)\s*(?:<img)/s,
    );
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
  }

  if (!eventName) {
    const ogMatch = body.match(
      /<meta\s+property="og:title"\s+content="([^"]+)"/,
    );
    if (ogMatch) {
      eventName = ogMatch[1];
    }
  }

  const metadata = { productId, eventName, eventDate, eventLocation };
  metadataCache.set(perfId, metadata);

  console.log(
    `[FIFA] ✅ Metadata fetched: productId=${productId} eventName="${eventName || "?"}" eventDate="${eventDate || "?"}"`,
  );

  return metadata;
}

/**
 * Parses a FIFA section string into individual category names.
 * Handles multiple input formats:
 *   - Comma-separated: "Category 1,Category 2,Category 3"
 *   - Space-separated (from section picker): "CATEGORY 1 CATEGORY 2 CATEGORY 3"
 *   - Mixed: "Category 1, CATEGORY 2"
 *
 * @param {string} sectionStr - Raw section string from DB
 * @returns {string[]} - Array of lowercase category names
 */
function parseFifaSectionString(sectionStr) {
  if (!sectionStr) return [];

  // If it contains commas, split on comma (explicit delimiter)
  if (sectionStr.includes(",")) {
    return sectionStr
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
  }

  // No commas — try to detect "Category N" patterns (e.g. "CATEGORY 1 CATEGORY 2 CATEGORY 3")
  // This regex matches "category" followed by optional space and a number/letter suffix
  const categoryPattern = /category\s+\S+/gi;
  const matches = sectionStr.match(categoryPattern);
  if (matches && matches.length > 0) {
    console.log(
      `[FIFA] 📝 Parsed space-separated categories: ${matches.map((m) => `"${m}"`).join(", ")}`,
    );
    return matches.map((m) => m.trim().toLowerCase());
  }

  // Fallback: treat entire string as one category name
  return [sectionStr.trim().toLowerCase()].filter((s) => s.length > 0);
}

/**
 * Counts total available resale seats for a given category from areaBlocksAvailability.
 * Sums availabilityResale values across all blocks belonging to the category.
 *
 * @param {object} cat - The priceRangeCategory object
 * @param {object} areaBlocksAvailability - Map of blockId -> { availability, availabilityResale }
 * @returns {number} - Total available resale seats for this category
 */
function countAvailableSeats(cat, areaBlocksAvailability) {
  if (!areaBlocksAvailability || !cat.blocks) return 0;

  let total = 0;

  for (const block of cat.blocks) {
    const blockId = block.id?.toString();
    if (!blockId) continue;

    const blockAvail = areaBlocksAvailability[blockId];
    if (blockAvail && typeof blockAvail.availabilityResale === "number") {
      total += blockAvail.availabilityResale;
    }
  }

  return total;
}

/**
 * Checks ticket availability on FIFA WC26 via the seatmap availability API.
 * Resale-only — shop variant is not supported.
 *
 * NOTE: This function handles ALL sections in a single API call.
 * runQuery passes each section separately, but the API returns all categories at once.
 * The section parameter filters which category to check in the response.
 *
 * @param {object} opts
 * @param {string} opts.eventId - perfId from URL
 * @param {string|null} opts.section - Category name (EN) to match, null = any category
 * @param {number} opts.minSeats - Minimum available seats required
 * @param {number|null} opts.maxPrice - Max per-ticket price in cents (USD), null = no limit
 * @param {string} opts.variant - Must be "resale" (enforced)
 * @param {string|null} opts.productId - Pre-cached productId from DB (skips metadata page fetch)
 * @returns {Promise<object>}
 */
export async function fetchFIFA({
  eventId,
  section,
  minSeats = 1,
  maxPrice,
  variant = "resale",
  productId: cachedProductId = null,
}) {
  const start = Date.now();
  const perfId = eventId;

  // ── Phase: Variant enforcement ──
  if (variant !== "resale") {
    console.error(
      `[FIFA] ❌ Variant "${variant}" is not supported — FIFA is resale-only`,
    );
    return {
      success: false,
      errorMessage: `FIFA_VARIANT_ERROR: Only "resale" variant is supported, got: "${variant}"`,
      errorCategory: "CONFIG_ERROR",
      retryable: false,
      latencyMs: Date.now() - start,
    };
  }

  // ── Phase: Load and validate cookies ──
  console.log(`[FIFA] 🔄 Phase: Loading cookies for variant=resale`);
  let cookieString;
  try {
    cookieString = await loadFifaCookies("resale");
  } catch (err) {
    console.error(`[FIFA] ❌ Cookie/session error: ${err.message}`);
    // All cookie errors are retryable auth problems, not hard crashes
    return {
      success: false,
      errorMessage: err.message,
      errorCategory: "AUTH_ERROR",
      retryable: true,
      latencyMs: Date.now() - start,
    };
  }

  const baseUrl = "https://fwc26-resale-usd.tickets.fifa.com";

  try {
    // ── Phase: Rate limit / cooldown check ──
    const rateLimitResult = await waitForRateLimit();
    if (rateLimitResult.skip) {
      return {
        success: false,
        errorMessage: rateLimitResult.skipReason,
        errorCategory: "COOLDOWN_SKIP",
        retryable: true,
        _fifaCooldownSkipped: true,
        latencyMs: Date.now() - start,
      };
    }

    // ── Phase: Get productId ──
    let productId = cachedProductId;
    let eventName = null;
    let eventDate = null;

    if (productId) {
      // Use cached productId — skip metadata page entirely
      console.log(
        `[FIFA] ✅ Using DB-cached productId=${productId} — skipping metadata page fetch`,
      );
      // Try to get eventName/eventDate from in-memory cache
      if (metadataCache.has(perfId)) {
        const cached = metadataCache.get(perfId);
        eventName = cached.eventName;
        eventDate = cached.eventDate;
      }
    } else {
      // Fetch metadata page to extract productId
      // (fetchPageMetadata has its own in-memory cache — only makes HTTP request on cache miss)
      const cacheHadEntry = metadataCache.has(perfId);
      const metadata = await fetchPageMetadata(perfId, cookieString, baseUrl);
      productId = metadata.productId;
      eventName = metadata.eventName;
      eventDate = metadata.eventDate;

      // Wait 10s ONLY after a real HTTP request (not in-memory cache hit)
      if (!cacheHadEntry) {
        console.log(
          `[FIFA] ⏳ Metadata fetched via HTTP — waiting 10s before availability API call`,
        );
        await new Promise((r) => setTimeout(r, 10000));
      }
    }

    // ── Phase: Availability API call ──
    console.log(
      `[FIFA] 🔄 Phase: Calling availability API (perfId=${perfId} productId=${productId})`,
    );

    // Re-read cookies fresh before availability call (may have been refreshed by harvester)
    let freshCookieString;
    try {
      freshCookieString = await loadFifaCookies("resale");
    } catch {
      freshCookieString = cookieString; // fallback to original
    }

    const availUrl =
      `${baseUrl}/tnwr/v1/secure/seatmap/availability` +
      `?perfId=${perfId}&productId=${productId}` +
      `&isSeasonTicketMode=false&advantageId=&withPriceRange=true` +
      `&ppid=&reservationIdx=&crossSellId=&baseOperationIdsString=`;

    const availResponse = await gotScraping({
      url: availUrl,
      headers: {
        ...buildHeaders(freshCookieString, perfId, baseUrl),
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
      // 403 = DataDome block — cooldown başlat
      if (availResponse.statusCode === 403) {
        activateCooldown();
      }
      console.error(
        `[FIFA] ❌ Availability API failed: HTTP ${availResponse.statusCode}`,
      );
      return {
        success: false,
        errorMessage: `FIFA_AVAIL_ERROR: Availability API ${availResponse.statusCode} döndürdü`,
        errorCategory: "HTTP_ERROR",
        httpStatus: availResponse.statusCode,
        retryable: true,
        latencyMs: Date.now() - start,
        // Return productId so runQuery can still persist it even on API failure
        _extractedProductId: productId,
      };
    }

    let data;
    try {
      data = JSON.parse(availResponse.body);
    } catch {
      console.error(
        `[FIFA] ❌ Availability API response is not valid JSON`,
      );
      return {
        success: false,
        errorMessage: "FIFA_PARSE_ERROR: Availability API JSON parse edilemedi",
        errorCategory: "PARSING_ERROR",
        retryable: false,
        latencyMs: Date.now() - start,
        _extractedProductId: productId,
      };
    }

    // ── Phase: Process priceRangeCategories ──
    const categories = data.priceRangeCategories || [];
    const isBroadMode = !section;

    // Build a set of target category names for multi-category matching
    // Handles both comma-separated ("Category 1,Category 3") and
    // space-separated from section picker ("CATEGORY 1 CATEGORY 2 CATEGORY 3")
    const targetCategoryNames = isBroadMode
      ? null
      : parseFifaSectionString(section);

    let isAvailable = false;
    let cheapestMatchingPrice = null;
    let priceExceeded = false;

    for (const cat of categories) {
      const catNameEN = cat.name?.en || "";

      // Section filtering: match category name against target list (case-insensitive)
      if (targetCategoryNames) {
        if (!targetCategoryNames.includes(catNameEN.toLowerCase())) {
          continue;
        }
      }

      // --- MinSeats check via category-level areaBlocksAvailability (resale only) ---
      // IMPORTANT: areaBlocksAvailability lives INSIDE each category object, not at the top level
      const catAreaBlocks = cat.areaBlocksAvailability || {};
      const totalSeats = countAvailableSeats(cat, catAreaBlocks);

      console.log(
        `[FIFA]   📊 "${catNameEN}": ${totalSeats} resale seats (minSeats=${minSeats})`,
      );

      if (totalSeats < minSeats) {
        // Not enough seats in this category, skip it
        continue;
      }

      // --- Price extraction (resale: seatPriceRanges with 15% tax) ---
      const catId = cat.id?.toString();
      const seatPriceRanges =
        data.seatMapPriceRanges?.seatPriceRangesBySeatCat?.[catId];

      let priceCents = null;

      if (seatPriceRanges?.min != null) {
        const basePrice = seatPriceRanges.min / 10;
        priceCents = Math.round(basePrice * 1.15);
      }

      if (priceCents == null) continue;

      // Track cheapest matching price
      if (
        cheapestMatchingPrice === null ||
        priceCents < cheapestMatchingPrice
      ) {
        cheapestMatchingPrice = priceCents;
      }

      // Check price constraint
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

    console.log(
      `[FIFA] ✅ Availability API success: available=${isAvailable} price=${cheapestMatchingPrice} priceExceeded=${!isAvailable && priceExceeded} (${latencyMs}ms)`,
    );

    return {
      success: true,
      isAvailable,
      foundPrice: cheapestMatchingPrice,
      priceExceeded: !isAvailable && priceExceeded,
      eventName,
      eventDate,
      latencyMs,
      // Return productId so runQuery can persist it to DB
      _extractedProductId: productId,
    };
  } catch (err) {
    // Only clear cache on page-level errors (HTML parsing/fetch failures).
    // Availability API errors (403, 500 etc.) should NOT invalidate the cached productId/metadata.
    if (
      err.message.includes("FIFA_PAGE_ERROR") ||
      err.message.includes("FIFA_PARSE_ERROR")
    ) {
      metadataCache.delete(perfId);
    }

    console.error(`[FIFA] ❌ Unexpected error: ${err.message}`);

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
