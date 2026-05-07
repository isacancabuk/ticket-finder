import "dotenv/config";
import express from "express";
import cors from "cors";

import queryRoutes from "./routes/query.routes.js";
import { startScheduler } from "./scheduler/startScheduler.js";
import {
  getNextUKQueryToRun,
  getNextNonUKQueryToRun,
} from "./services/getNextQueryToRun.js";

const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "https://ticket-finder-alpha.vercel.app"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "ngrok-skip-browser-warning"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.use("/api/queries", queryRoutes);

const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Backend running on port ${PORT} (host: ${HOST})`);
  // Start two independent scheduler lanes: one for UK, one for non-UK (DE/ES)
  // UK scheduler uses 20s interval (heavier pagination-based work)
  // Non-UK scheduler uses 8s interval (lighter, faster domains)
  startScheduler("uk", getNextUKQueryToRun, 30 * 1000);
  startScheduler("non-uk", getNextNonUKQueryToRun, 7 * 1000);
});
