/* eslint-disable n/no-process-exit -- this is the process entry point; exiting is its job */
// Entry point: connect to MongoDB, start listening, and shut down cleanly on Ctrl+C or a deploy.
import { createServer } from "node:http";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { createApp } from "./app.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

// Last-resort handlers: log the crash, then exit so the process manager restarts a clean process.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ event: "process.unhandledRejection", err: reason }, "Unhandled promise rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ event: "process.uncaughtException", err }, "Uncaught exception");
  process.exit(1);
});

try {
  await connectDb(config.MONGODB_URI);
} catch (err) {
  logger.fatal({ event: "db.connect_failed", err }, "Could not connect to MongoDB; exiting");
  process.exit(1);
}

const server = createServer(createApp());
server.listen(config.PORT, () => {
  logger.info(
    { event: "server.started", port: config.PORT },
    `API listening on http://localhost:${config.PORT}`,
  );
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return; // a second Ctrl+C should not start a second shutdown
  shuttingDown = true;
  logger.info({ event: "server.stopping", signal }, "Shutting down");

  // If something hangs (a slow request, a stuck socket), force the exit after 10 s.
  // unref() means this timer alone will not keep the process alive.
  setTimeout(() => {
    logger.error({ event: "server.shutdown_timeout" }, "Forced exit after timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  try {
    // Stop taking new connections and wait for in-flight requests, then close the DB.
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await disconnectDb();
    logger.info({ event: "server.stopped" }, "Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error({ event: "server.shutdown_failed", err }, "Error during shutdown");
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
