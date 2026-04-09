import "dotenv/config";
import express from "express";
import cors from "cors";

import queryRoutes from "./routes/query.routes.js";
import { startScheduler } from "./scheduler/startScheduler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/queries", queryRoutes);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  startScheduler();
});
