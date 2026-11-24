// One shared pino logger. It writes JSON lines; pino-http adds a child logger per request (req.log).
import pino from "pino";
import { config } from "./env.js";
import pkg from "../../package.json" with { type: "json" };

export const logger = pino({
  level: config.LOG_LEVEL,
  // These fields are added to every log line, so logs from different deploys can be told apart.
  base: { service: "nivaran-server", version: pkg.version, env: config.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Never write credentials to logs, even when a whole request is logged.
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    censor: "[REDACTED]",
  },
});
