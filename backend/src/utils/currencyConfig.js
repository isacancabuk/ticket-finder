/**
 * Centralized currency configuration.
 * Domain → native currency mapping and display symbols.
 */

// Each Ticketmaster domain returns prices in a fixed currency
export const DOMAIN_CURRENCY = {
  DE: "EUR",
  UK: "GBP",
  ES: "EUR",
};

// ISO 4217 → display symbol
export const CURRENCY_SYMBOLS = {
  EUR: "€",
  GBP: "£",
  USD: "$",
  TRY: "₺",
};

// Allowed currencies for salePrice input
export const SUPPORTED_SALE_CURRENCIES = ["EUR", "GBP", "USD", "TRY"];

// System-wide base currency for future FX normalization
export const BASE_CURRENCY = "EUR";

/**
 * Format a price in cents to a display string with the correct symbol.
 * @param {number|null} cents
 * @param {string} currencyCode - ISO 4217 code (e.g. "EUR", "GBP")
 * @returns {string}
 */
export function formatPriceByCurrency(cents, currencyCode) {
  if (cents == null) return "–";
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}
