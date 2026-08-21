import pino from "pino";

/** Minimal internal logger for this package - not the app's request logger. */
export const logger = pino({ name: "@sql-learn/database" });
