import axios from "axios";

/**
 * In-memory FX rate cache backed by the Frankfurter API.
 * Rates are daily ECB reference rates — refreshed once per day.
 *
 * Usage:
 *   const rate = await getRate("GBP", "EUR");  // e.g. 1.15
 *   const converted = await convert(15000, "GBP", "EUR"); // cents
 */

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

// Cache: { "EUR": { "GBP": 0.869, "USD": 1.178, ... }, ... }
let ratesCache = {};
let lastFetchedAt = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch latest rates from Frankfurter for a given base currency.
 * Caches the result in memory.
 */
async function fetchRates(base = "EUR") {
  try {
    const res = await axios.get(`${FRANKFURTER_BASE}/latest`, {
      params: { base },
      timeout: 5000,
    });

    if (res.data && res.data.rates) {
      ratesCache[base] = { ...res.data.rates };
      // Self-reference: 1 EUR = 1 EUR
      ratesCache[base][base] = 1;
      lastFetchedAt = Date.now();
      console.log(
        `[fxService] Refreshed rates for ${base}: ${Object.keys(res.data.rates).length} currencies`
      );
    }
  } catch (err) {
    console.error(`[fxService] Failed to fetch rates: ${err.message}`);
    // Keep stale cache if available — never block on failure
  }
}

/**
 * Check if the cache needs a refresh.
 */
function isCacheStale() {
  if (!lastFetchedAt) return true;
  return Date.now() - lastFetchedAt > CACHE_TTL_MS;
}

/**
 * Ensure rates are loaded and reasonably fresh.
 */
async function ensureRates(base = "EUR") {
  if (isCacheStale() || !ratesCache[base]) {
    await fetchRates(base);
  }
}

/**
 * Get the exchange rate from one currency to another.
 * Returns null if rate is unavailable.
 *
 * @param {string} from - ISO 4217 code (e.g. "GBP")
 * @param {string} to   - ISO 4217 code (e.g. "EUR")
 * @returns {Promise<number|null>}
 */

export async function getRate(from, to) {
  if (from === to) return 1;

  await ensureRates("EUR");

  // Try direct: EUR -> X
  if (from === "EUR" && ratesCache["EUR"]?.[to]) {
    return ratesCache["EUR"][to];
  }

  // Try inverse: X -> EUR (1 / rate)
  if (to === "EUR" && ratesCache["EUR"]?.[from]) {
    return 1 / ratesCache["EUR"][from];
  }

  // Cross rate via EUR: X -> EUR -> Y
  const fromToEur = ratesCache["EUR"]?.[from];
  const toFromEur = ratesCache["EUR"]?.[to];
  if (fromToEur && toFromEur) {
    return toFromEur / fromToEur;
  }

  return null;
}

/**
 * Convert an amount in cents from one currency to another.
 * Returns null if conversion is not possible.
 *
 * @param {number} cents - Amount in source currency cents
 * @param {string} from  - Source ISO 4217 code
 * @param {string} to    - Target ISO 4217 code
 * @returns {Promise<number|null>} - Amount in target currency cents
 */
export async function convert(cents, from, to) {
  if (from === to) return cents;
  if (cents == null) return null;

  const rate = await getRate(from, to);
  if (rate == null) return null;

  return Math.round(cents * rate);
}
