import "dotenv/config";
import express from "express";
import cors from "cors";

import queryRoutes from "./routes/query.routes.js";
import { startScheduler } from "./scheduler/startScheduler.js";

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://ticket-finder-alpha.vercel.app",
  ],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "ngrok-skip-browser-warning"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.use("/api/queries", queryRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startScheduler();
});
