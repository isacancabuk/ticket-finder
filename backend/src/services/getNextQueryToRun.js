import prisma from "../prisma.js";

/**
 * Tracks the domain of the last selected query so the scheduler can
 * avoid picking the same domain back-to-back when alternatives exist.
 * Resets to null on server restart (acceptable — first tick uses oldest-first).
 */
let lastSelectedDomain = null;

/** Shared filter: exclude STOPPED and PURCHASED queries. */
const ELIGIBLE_WHERE = {
  status: { notIn: ["STOPPED", "PURCHASED"] },
};

/** Shared ordering: oldest-checked first, new queries first. */
const OLDEST_FIRST = [
  { lastCheckedAt: { sort: "asc", nulls: "first" } },
  { createdAt: "asc" },
];

/**
 * Returns the next query that should be checked by the scheduler.
 *
 * Selection logic:
 *   1. If a domain was selected on the previous tick, prefer the oldest
 *      eligible query from a DIFFERENT domain (diversity / anti-repeat).
 *   2. If no different-domain query exists (or this is the first tick),
 *      fall back to the oldest eligible query regardless of domain
 *      (preserves current oldest-first fairness).
 *
 * @returns {Promise<import("@prisma/client").Query | null>}
 */
export async function getNextQueryToRun() {
  // Phase 0: prioritise queries that have NEVER been checked yet
  const neverChecked = await prisma.query.findFirst({
    where: {
      ...ELIGIBLE_WHERE,
      lastCheckedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (neverChecked) {
    lastSelectedDomain = neverChecked.domain;
    return neverChecked;
  }

  // Phase 1: try to pick a query from a different domain than last time
  if (lastSelectedDomain) {
    const preferred = await prisma.query.findFirst({
      where: {
        ...ELIGIBLE_WHERE,
        domain: { not: lastSelectedDomain },
      },
      orderBy: OLDEST_FIRST,
    });

    if (preferred) {
      lastSelectedDomain = preferred.domain;
      return preferred;
    }
  }

  // Phase 2: fallback — oldest eligible query from any domain
  const fallback = await prisma.query.findFirst({
    where: ELIGIBLE_WHERE,
    orderBy: OLDEST_FIRST,
  });

  if (fallback) {
    lastSelectedDomain = fallback.domain;
  }

  return fallback;
}

/**
 * Returns the next UK query that should be checked.
 * Used by the dedicated UK scheduler lane.
 *
 * @returns {Promise<import("@prisma/client").Query | null>}
 */
export async function getNextUKQueryToRun() {
  // Prioritise never-checked queries
  const neverChecked = await prisma.query.findFirst({
    where: {
      ...ELIGIBLE_WHERE,
      domain: "UK",
      lastCheckedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (neverChecked) return neverChecked;

  const query = await prisma.query.findFirst({
    where: {
      ...ELIGIBLE_WHERE,
      domain: "UK",
    },
    orderBy: OLDEST_FIRST,
  });

  return query;
}

/**
 * Returns the next non-UK query (DE, ES, NL, PL, or BE) that should be checked.
 * Used by the dedicated non-UK scheduler lane.
 *
 * @returns {Promise<import("@prisma/client").Query | null>}
 */
export async function getNextNonUKQueryToRun() {
  // Prioritise never-checked queries
  const neverChecked = await prisma.query.findFirst({
    where: {
      ...ELIGIBLE_WHERE,
      domain: { in: ["DE", "ES", "NL", "PL", "BE"] },
      lastCheckedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (neverChecked) return neverChecked;

  const query = await prisma.query.findFirst({
    where: {
      ...ELIGIBLE_WHERE,
      domain: { in: ["DE", "ES", "NL", "PL", "BE"] },
    },
    orderBy: OLDEST_FIRST,
  });

  return query;
}
