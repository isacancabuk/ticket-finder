import prisma from "../prisma.js";

/**
 * Returns the next query that should be checked by the scheduler.
 *
 * Selection logic:
 *   - Excludes STOPPED queries
 *   - Orders by lastCheckedAt ASC (oldest first = fair round-robin)
 *   - Queries with lastCheckedAt = null are picked immediately (new queries)
 *
 * @returns {Promise<import("@prisma/client").Query | null>}
 */
export async function getNextQueryToRun() {
  return prisma.query.findFirst({
    where: {
      status: {
        notIn: ["STOPPED", "PURCHASED"],
      },
    },
    orderBy: [
      { lastCheckedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
  });
}
