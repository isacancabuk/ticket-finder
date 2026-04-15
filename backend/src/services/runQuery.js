import prisma from "../prisma.js";
import { fetchDE } from "../../fetch-de.js";
// UK varsa import edilecek

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
    if (query.domain === "DE") {
      result = await fetchDE({
        eventId: query.eventId,
        section: query.section || null,
        minSeats: query.minSeats || 1,
        maxPrice: query.maxPrice,
      });
    } else {
      throw new Error("UNSUPPORTED_DOMAIN");
    }
  } catch (err) {
    result = {
      success: false,
      errorMessage: err.message,
      errorCategory: "UNKNOWN",
    };
  }

  const latencyMs = Date.now() - start;

  let newStatus = "ERROR";
  let isAvailable = false;
  let foundPrice = null;
  let priceExceeded = false;
  let httpStatus = null;
  let errorMessage = null;
  let errorCategory = null;

  if (result.success) {
    isAvailable = result.isAvailable;
    newStatus = result.isAvailable ? "FOUND" : "FINDING";
    foundPrice = result.foundPrice ?? null;
    priceExceeded = result.priceExceeded ?? false;
  } else {
    newStatus = "ERROR";
    errorMessage = result.errorMessage || "UNKNOWN: Unknown error";
    httpStatus = result.httpStatus || null;
    errorCategory = result.errorCategory || "UNKNOWN";

    // Structured log for observability
    console.error(
      `[runQuery] queryId=${queryId} category=${errorCategory} ` +
        `httpStatus=${httpStatus} retryable=${result.retryable ?? "unknown"} ` +
        `message="${errorMessage}"`
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
        lastErrorMessage: errorMessage,
        lastCheckedAt: new Date(),
      },
    });

    // Log kaydı
    await prisma.checkResult.create({
      data: {
        queryId: queryId,
        status: newStatus,
        isAvailable,
        foundPrice,
        priceExceeded,
        eventName: updatedQuery.eventName,
        httpStatus,
        errorMessage,
        latencyMs,
      },
    });

    return {
      ...updatedQuery,
      updatedQuery,
      previousStatus: query.status,
      previousIsAvailable: query.isAvailable,
      currentStatus: newStatus,
      currentIsAvailable: isAvailable,
      foundPrice,
      priceExceeded,
      errorMessage,
      errorCategory
    };
  } catch (dbErr) {
    console.error(
      `[runQuery] DB write failed for queryId=${queryId}:`,
      dbErr.message
    );
    throw new Error("DB_WRITE_FAILED");
  }
}