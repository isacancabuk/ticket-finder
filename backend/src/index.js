import "dotenv/config";
import express from "express";
import cors from "cors";

import queryRoutes from "./routes/query.routes.js";
import { startScheduler } from "./scheduler/startScheduler.js";
import {
  getNextUKQueryToRun,
  getNextNonUKQueryToRun,
  getNextMXQueryToRun,
  getNextFIFAQueryToRun,
} from "./services/getNextQueryToRun.js";

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "https://ticket-finder-alpha.vercel.app"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "ngrok-skip-browser-warning",
    "Bypass-Tunnel-Reminder",
  ],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.use("/api/queries", queryRoutes);

const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0";
const mode = process.env.RUN_MODE || "all";

if (mode === "all" || mode === "uk_api") {
  app.listen(PORT, HOST, () => {
    console.log(`Backend API running on port ${PORT} (host: ${HOST})`);
  });
}

console.log(`Starting schedulers for mode: ${mode}`);

if (mode === "all" || mode === "uk_api") {
  startScheduler("uk", getNextUKQueryToRun, 30 * 1000);
}
if (mode === "all" || mode === "non_uk") {
  startScheduler("non-uk", getNextNonUKQueryToRun, 7 * 1000);
}
if (mode === "all" || mode === "mx") {
  startScheduler("mx", getNextMXQueryToRun, 30 * 1000);
}
if (mode === "all" || mode === "fifa") {
  startScheduler("fifa", getNextFIFAQueryToRun, 45 * 1000);
}
if (mode === "fifa_cookie") {
  console.log("FIFA Cookie Harvester (Puppeteer) çalıştırılıyor...");
  import("./fetchers/test-puppeteer.js").catch(console.error);
}
