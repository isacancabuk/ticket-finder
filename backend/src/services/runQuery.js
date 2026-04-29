import prisma from "../prisma.js";
import { fetchDE } from "../../fetch-de.js";
import { fetchES } from "../../fetch-es.js";
import { fetchUK } from "../../fetch-uk.js";
import {
  normalizePricesToEUR,
  calculateProfitLoss,
} from "../utils/enrichQueryResponse.js";

/**
 * Executes a query and updates the database with the result.
 *
 * @param {string} queryId - ID of the query to run
 * @returns {Promise<void>}
 */

export async function runQuery(queryId) {
  const query = await prisma.query.findUnique({
    where: { id: queryId },
  });

  if (!query) {
    throw new Error("QUERY_NOT_FOUND");
  }

  if (query.status === "STOPPED") {
    throw new Error("QUERY_STOPPED");
  }

  // Status'u FINDING yap
  await prisma.query.update({
    where: { id: queryId },
    data: {
      status: "FINDING",
      lastCheckedAt: new Date(),
      lastErrorMessage: null,
    },
  });

  const start = Date.now();

  let result;

  try {
    // Parse multiple sections (space or comma separated)
    const sectionString = query.section ? query.section.trim() : null;
    const sectionsToCheck = sectionString
      ? sectionString.split(/[\s,]+/).filter((s) => s.length > 0)
      : [null]; // null means broad availability mode

    // Check each section and merge results
    let mergedResult = {
      success: false,
      isAvailable: false,
      foundPrice: null,
      priceExceeded: false,
      foundSections: [],
    };

    // Track prices separately to avoid mixing available vs price-exceeded results
    let lowestAvailablePrice = null;
    let lowestPriceExceededPrice = null;

    for (const section of sectionsToCheck) {
      let sectionResult;

      if (query.domain === "DE") {
        sectionResult = await fetchDE({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "ES") {
        sectionResult = await fetchES({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "UK") {
        sectionResult = await fetchUK({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else {
        throw new Error("UNSUPPORTED_DOMAIN");
      }

      // Merge results: if any section found tickets, mark as found
      if (sectionResult.success) {
        if (!mergedResult.success) {
          // Reset mergedResult back to a clean success state in case it was overwritten by a previous error
          mergedResult = {
            success: true,
            isAvailable: false,
            foundPrice: null,
            priceExceeded: false,
            foundSections: [],
          };
        } else {
          mergedResult.success = true;
        }

        // Track priceExceeded independently: if ANY section has price exceeded, mark it
        if (sectionResult.priceExceeded) {
          mergedResult.priceExceeded = true;
        }

        if (sectionResult.isAvailable) {
          mergedResult.isAvailable = true;
          // Track which section found tickets
          if (section) {
            mergedResult.foundSections.push(section);
          }
          // Track available prices separately
          if (sectionResult.foundPrice != null) {
            if (
              lowestAvailablePrice == null ||
              sectionResult.foundPrice < lowestAvailablePrice
            ) {
              lowestAvailablePrice = sectionResult.foundPrice;
            }
          }
        } else if (
          sectionResult.priceExceeded &&
          sectionResult.foundPrice != null
        ) {
          // Track price-exceeded sections too
          if (section) {
            mergedResult.foundSections.push(section);
          }
          // Track price-exceeded prices separately (only when not available)
          if (
            lowestPriceExceededPrice == null ||
            sectionResult.foundPrice < lowestPriceExceededPrice
          ) {
            lowestPriceExceededPrice = sectionResult.foundPrice;
          }
        }
      } else {
        // If any section fails, propagate error
        if (!mergedResult.success) {
          mergedResult = sectionResult;
        }
      }
    }

    // Set final foundPrice: prefer available prices over price-exceeded prices
    if (lowestAvailablePrice != null) {
      mergedResult.foundPrice = lowestAvailablePrice;
    } else if (lowestPriceExceededPrice != null) {
      mergedResult.foundPrice = lowestPriceExceededPrice;
    }

    result = mergedResult;
  } catch (err) {
    result = {
      success: false,
      errorMessage: err.message,
      errorCategory: "UNKNOWN",
    };
  }

  const latencyMs = Date.now() - start;

  let newStatus = "ERROR";
  let isAvailable = query.isAvailable ?? false;
  let foundPrice = query.foundPrice ?? null;
  let priceExceeded = query.priceExceeded ?? false;
  let foundSectionStr = query.foundSection ?? null;
  let httpStatus = null;
  let errorMessage = null;
  let errorCategory = null;

  if (result.success) {
    isAvailable = result.isAvailable ?? false;
    newStatus = result.isAvailable ? "FOUND" : "FINDING";
    foundPrice = result.foundPrice ?? null;
    priceExceeded = result.priceExceeded ?? false;

    // Format found sections string (deduplicate and join with comma)
    if (result.foundSections && result.foundSections.length > 0) {
      foundSectionStr = [...new Set(result.foundSections)].join(", ");
    } else {
      foundSectionStr = null;
    }
  } else {
    newStatus = "ERROR";
    errorMessage = result.errorMessage || "UNKNOWN: Unknown error";
    httpStatus = result.httpStatus || null;
    errorCategory = result.errorCategory || "UNKNOWN";

    // Structured log for observability
    console.error(
      `[runQuery] queryId=${queryId} category=${errorCategory} ` +
        `httpStatus=${httpStatus} retryable=${result.retryable ?? "unknown"} ` +
        `message="${errorMessage}"`,
    );
  }

  // Persist results to database
  try {
    const updatedQuery = await prisma.query.update({
      where: { id: queryId },
      data: {
        status: newStatus,
        isAvailable,
        foundPrice,
        priceExceeded,
        foundSection: foundSectionStr,
        lastErrorMessage: errorMessage,
        lastCheckedAt: new Date(),
      },
    });

    // EUR normalization for Telegram message
    const { salePriceInEUR, foundPriceInEUR } =
      await normalizePricesToEUR(updatedQuery);
    const { profitLoss, profitLossCurrency } = calculateProfitLoss(
      salePriceInEUR,
      foundPriceInEUR,
    );

    // Log kaydı
    await prisma.checkResult.create({
      data: {
        queryId: queryId,
        status: newStatus,
        isAvailable,
        foundPrice,
        priceExceeded,
        foundSection: foundSectionStr,
        eventName: updatedQuery.eventName,
        httpStatus,
        errorMessage,
        latencyMs,
      },
    });

    return {
      ...updatedQuery,
      updatedQuery: {
        ...updatedQuery,
        salePriceInEUR,
        foundPriceInEUR,
        profitLoss,
        profitLossCurrency,
      },
      previousStatus: query.status,
      previousIsAvailable: query.isAvailable,
      currentStatus: newStatus,
      currentIsAvailable: isAvailable,
      foundPrice,
      priceExceeded,
      errorMessage,
      errorCategory,
    };
  } catch (dbErr) {
    console.error(
      `[runQuery] DB write failed for queryId=${queryId}:`,
      dbErr.message,
    );
    throw new Error("DB_WRITE_FAILED");
  }
}
