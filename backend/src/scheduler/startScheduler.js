import { getNextQueryToRun } from "../services/getNextQueryToRun.js";
import { runQuery } from "../services/runQuery.js";
import { buildNotificationDecision } from "../services/buildNotificationDecision.js";
import { buildTelegramMessage } from "../services/buildTelegramMessage.js";
import { sendTelegramMessage } from "../services/sendTelegramMessage.js";

const DEFAULT_TICK_INTERVAL_MS = 8 * 1000; // 8 seconds

/**
 * Starts a scheduler lane.
 *
 * @param {string} lane - Lane identifier (e.g., 'uk', 'non-uk', 'all') for logging
 * @param {Function} querySelectorFn - Function that returns the next query to run
 *                                     (defaults to getNextQueryToRun for backward compatibility)
 * @param {number} tickIntervalMs - Tick interval in milliseconds (defaults to 8000ms)
 */
export function startScheduler(
  lane = "all",
  querySelectorFn = getNextQueryToRun,
  tickIntervalMs = DEFAULT_TICK_INTERVAL_MS,
) {
  let isRunning = false;

  console.log(
    `[scheduler-${lane}] Scheduler started (tick every ${tickIntervalMs}ms)`,
  );

  setInterval(async () => {
    if (isRunning) {
      console.log(`[scheduler-${lane}] Skipping tick (still running)`);
      return;
    }

    isRunning = true;

    try {
      const query = await querySelectorFn();

      if (!query) {
        console.log(`[scheduler-${lane}] No active queries`);
        return;
      }

      console.log(
        `[scheduler-${lane}] Running query (domain=${query.domain} eventId=${query.eventId} eventName="${query.eventName || "Unknown Event"}" section=${query.section || "ALL"})`,
      );

      const result = await runQuery(query.id);

      try {
        const decision = buildNotificationDecision(result);
        if (decision.shouldNotify) {
          const message = await buildTelegramMessage(result.updatedQuery);
          await sendTelegramMessage(message);
        }
      } catch (notifyErr) {
        console.error(
          `[scheduler-${lane}] Notification error:`,
          notifyErr.message,
        );
      }
    } catch (err) {
      console.error(`[scheduler-${lane}] Error:`, err.message);
    } finally {
      isRunning = false;
    }
  }, tickIntervalMs);
}
