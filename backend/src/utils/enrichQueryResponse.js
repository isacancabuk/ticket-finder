import { DOMAIN_CURRENCY, BASE_CURRENCY } from "./currencyConfig.js";
import { convert } from "../services/fxService.js";

/**
 * Normalize a query's prices to EUR for comparison and reporting.
 * Handles currency conversion with explicit error logging.
 *
 * @param {Object} query - Query object from database
 * @returns {Promise<Object>} - { salePriceInEUR, foundPriceInEUR } or nulls on error
 */

export async function normalizePricesToEUR(query) {
  const foundCurrency = DOMAIN_CURRENCY[query.domain] || BASE_CURRENCY;
  const saleCurrency = query.salePriceCurrency || BASE_CURRENCY;
  const minSeats = query.minSeats || 1;

  // Calculate total found price for all seats
  const totalFoundPrice =
    query.foundPrice != null ? query.foundPrice * minSeats : null;

  // Initialize EUR normalization
  let salePriceInEUR = null;
  let foundPriceInEUR = null;

  // Convert sale price to EUR if needed
  if (query.salePrice != null) {
    if (saleCurrency === BASE_CURRENCY) {
      salePriceInEUR = query.salePrice;
    } else {
      try {
        salePriceInEUR = await convert(
          query.salePrice,
          saleCurrency,
          BASE_CURRENCY,
        );
      } catch (error) {
        console.error(
          `[enrichQueryResponse] FX conversion failed for salePrice: ${query.salePrice} ${saleCurrency} → EUR`,
          error.message,
        );
        // Leave as null on FX failure
      }
    }
  }

  // Convert found price to EUR if needed
  if (totalFoundPrice != null) {
    if (foundCurrency === BASE_CURRENCY) {
      foundPriceInEUR = totalFoundPrice;
    } else {
      try {
        foundPriceInEUR = await convert(
          totalFoundPrice,
          foundCurrency,
          BASE_CURRENCY,
        );
      } catch (error) {
        console.error(
          `[enrichQueryResponse] FX conversion failed for foundPrice: ${totalFoundPrice} ${foundCurrency} → EUR`,
          error.message,
        );
        // Leave as null on FX failure
      }
    }
  }

  return {
    salePriceInEUR,
    foundPriceInEUR,
  };
}

/**
 * Calculate profit/loss from EUR-normalized prices.
 * Pure calculation with no side effects.
 *
 * @param {number|null} salePriceInEUR - Sale price in EUR (cents)
 * @param {number|null} foundPriceInEUR - Found price in EUR (cents)
 * @returns {Object} - { profitLoss, profitLossCurrency } or { profitLoss: null, profitLossCurrency: null }
 */

export function calculateProfitLoss(salePriceInEUR, foundPriceInEUR) {
  if (salePriceInEUR == null || foundPriceInEUR == null) {
    return {
      profitLoss: null,
      profitLossCurrency: null,
    };
  }

  return {
    profitLoss: salePriceInEUR - foundPriceInEUR,
    profitLossCurrency: BASE_CURRENCY,
  };
}
