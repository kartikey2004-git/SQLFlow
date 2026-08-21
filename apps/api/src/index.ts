import dotenv from "dotenv";
dotenv.config();

if (!process.env.CLEANUP_TOKEN) {
  throw new Error("CLEANUP_TOKEN must be set - refusing to start without it (see .env.example)");
}

import { connectPostgres } from "@sql-learn/database";
import { createApp } from "./app";
import { logger } from "./utils/logger";

connectPostgres();

const app = createApp();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`API running on ${PORT}`);
});
