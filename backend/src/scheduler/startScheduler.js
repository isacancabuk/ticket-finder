import { getNextQueryToRun } from "../services/getNextQueryToRun.js";
import { runQuery } from "../services/runQuery.js";
import { buildNotificationDecision } from "../services/buildNotificationDecision.js";
import { buildTelegramMessage } from "../services/buildTelegramMessage.js";
import { sendTelegramMessage } from "../services/sendTelegramMessage.js";

const TICK_INTERVAL_MS = 10 * 1000; // 10 seconds

let isRunning = false;

export function startScheduler() {
  console.log("[scheduler] Scheduler started (tick every 10s)");

  setInterval(async () => {
    if (isRunning) {
      console.log("[scheduler] Skipping tick (still running)");
      return;
    }

    isRunning = true;

    try {
      const query = await getNextQueryToRun();

      if (!query) {
        console.log("[scheduler] No active queries");
        return;
      }

      console.log(
        `[scheduler] Running query (domain=${query.domain} eventId=${query.eventId} eventName="${query.eventName || "Unknown Event"}" section=${query.section || "ALL"})`,
      );

      const result = await runQuery(query.id);

      try {
        const decision = buildNotificationDecision(result);
        if (decision.shouldNotify) {
          const message = await buildTelegramMessage(result.updatedQuery);
          await sendTelegramMessage(message);
        }
      } catch (notifyErr) {
        console.error("[scheduler] Notification error:", notifyErr.message);
      }
    } catch (err) {
      console.error("[scheduler] Error:", err.message);
    } finally {
      isRunning = false;
    }
  }, TICK_INTERVAL_MS);
}
