import prisma from "../prisma.js";
import { fetchBE } from "../fetchers/fetch-be.js";
import { fetchCH } from "../fetchers/fetch-ch.js";
import { fetchFIFA } from "../fetchers/fetch-fifa.js";
import { fetchMX } from "../fetchers/fetch-mx.js";
import { fetchDE } from "../fetchers/fetch-de.js";
import { fetchES } from "../fetchers/fetch-es.js";
import { fetchNL } from "../fetchers/fetch-nl.js";
import { fetchPL } from "../fetchers/fetch-pl.js";
import { fetchSE } from "../fetchers/fetch-se.js";
import { fetchUK } from "../fetchers/fetch-uk.js";
import { parseTicketmasterUrl } from "../utils/parseTicketmasterUrl.js";
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

  // Mark query as actively being checked.
  // Skip status change for already-FOUND queries to prevent
  // FOUND→FINDING→FOUND flicker during slow rechecks (UK pagination).
  await prisma.query.update({
    where: { id: queryId },
    data: {
      ...(query.status !== "FOUND" && { status: "FINDING" }),
      lastCheckedAt: new Date(),
      lastErrorMessage: null,
    },
  });

  const start = Date.now();

  let result;

  try {
    // Parse multiple sections
    // FIFA: split on comma only (category names contain spaces, e.g. "Category 1")
    // Ticketmaster: split on space or comma (section codes are single tokens, e.g. "101 102")
    const sectionString = query.section ? query.section.trim() : null;
    let sectionsToCheck;
    if (!sectionString) {
      sectionsToCheck = [null]; // null means broad availability mode
    } else if (query.domain === "FIFA") {
      // FIFA categories contain spaces (e.g. "Category 1"), so we can't split on spaces naively.
      // Handle both comma-separated ("Category 1,Category 2") and
      // space-separated from section picker ("CATEGORY 1 CATEGORY 2 CATEGORY 3")
      if (sectionString.includes(",")) {
        sectionsToCheck = sectionString
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      } else {
        // Try to detect "Category N" patterns
        const categoryPattern = /category\s+\S+/gi;
        const matches = sectionString.match(categoryPattern);
        if (matches && matches.length > 0) {
          sectionsToCheck = matches.map((m) => m.trim());
        } else {
          // Fallback: treat as single section
          sectionsToCheck = [sectionString];
        }
      }
    } else {
      sectionsToCheck = sectionString
        .split(/[\s,]+/)
        .filter((s) => s.length > 0);
    }

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
      } else if (query.domain === "NL") {
        sectionResult = await fetchNL({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "PL") {
        sectionResult = await fetchPL({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "BE") {
        sectionResult = await fetchBE({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "SE") {
        sectionResult = await fetchSE({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "CH") {
        sectionResult = await fetchCH({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "MX") {
        sectionResult = await fetchMX({
          eventId: query.eventId,
          section: section,
          minSeats: query.minSeats || 1,
          maxPrice: query.maxPrice,
        });
      } else if (query.domain === "FIFA") {
        // FIFA is resale-only — extract variant and enforce
        let variant = "resale"; // default resale-only
        try {
          const parsed = parseTicketmasterUrl(query.eventUrl);
          if (parsed.variant) {
            variant = parsed.variant;
          }
        } catch {
          // If parsing fails, use default resale variant
        }

        // Fail explicitly if variant is not resale
        if (variant !== "resale") {
          console.error(
            `[runQuery] FIFA query ${queryId} has non-resale variant "${variant}" — failing explicitly`,
          );
          sectionResult = {
            success: false,
            errorMessage: `FIFA_VARIANT_ERROR: Only resale variant is supported, got: "${variant}"`,
            errorCategory: "CONFIG_ERROR",
            retryable: false,
          };
        } else {
          sectionResult = await fetchFIFA({
            eventId: query.eventId,
            section: section,
            minSeats: query.minSeats || 1,
            maxPrice: query.maxPrice,
            variant: "resale",
            productId: query.fifaProductId || null,
          });

          // Persist extracted productId to DB if not already stored
          if (
            sectionResult._extractedProductId &&
            !query.fifaProductId
          ) {
            try {
              await prisma.query.update({
                where: { id: queryId },
                data: { fifaProductId: sectionResult._extractedProductId },
              });
              console.log(
                `[runQuery] FIFA productId persisted: ${sectionResult._extractedProductId} (queryId=${queryId})`,
              );
            } catch (persistErr) {
              console.error(
                `[runQuery] Failed to persist FIFA productId: ${persistErr.message}`,
              );
            }
          }

          // Handle cooldown skip — don't mark as ERROR
          if (sectionResult._fifaCooldownSkipped) {
            console.log(
              `[runQuery] FIFA query ${queryId} skipped (cooldown active)`,
            );
            // Return early with a non-error result — preserve previous state
            const latencyMs = Date.now() - start;
            await prisma.checkResult.create({
              data: {
                queryId: queryId,
                status: query.status === "FOUND" ? "FOUND" : "FINDING",
                isAvailable: query.isAvailable ?? false,
                foundPrice: query.foundPrice ?? null,
                priceExceeded: query.priceExceeded ?? false,
                foundSection: query.foundSection ?? null,
                eventName: query.eventName,
                errorMessage: sectionResult.errorMessage,
                latencyMs,
              },
            });
            // Restore the lastCheckedAt without changing status
            await prisma.query.update({
              where: { id: queryId },
              data: { lastCheckedAt: new Date() },
            });
            return {
              ...query,
              updatedQuery: query,
              previousStatus: query.status,
              previousIsAvailable: query.isAvailable,
              currentStatus: query.status,
              currentIsAvailable: query.isAvailable,
              foundPrice: query.foundPrice,
              priceExceeded: query.priceExceeded,
              errorMessage: sectionResult.errorMessage,
              errorCategory: "COOLDOWN_SKIP",
            };
          }
        }
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

        // Propagate eventName if returned by the fetcher (e.g. FIFA)
        if (sectionResult.eventName && !mergedResult.eventName) {
          mergedResult.eventName = sectionResult.eventName;
        }

        // Propagate eventDate if returned by the fetcher (e.g. FIFA)
        if (sectionResult.eventDate && !mergedResult.eventDate) {
          mergedResult.eventDate = sectionResult.eventDate;
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
      mergedResult.priceExceeded = false;
    } else if (lowestPriceExceededPrice != null) {
      mergedResult.foundPrice = lowestPriceExceededPrice;
      mergedResult.priceExceeded = true;
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
        // Populate eventName and eventDate from fetcher if not yet set (FIFA populates this from page HTML)
        ...(result.eventName &&
          !query.eventName && { eventName: result.eventName }),
        ...(result.eventDate &&
          !query.eventDate && { eventDate: result.eventDate }),
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
