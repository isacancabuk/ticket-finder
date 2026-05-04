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
