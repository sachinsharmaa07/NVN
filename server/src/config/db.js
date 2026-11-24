// MongoDB connection via Mongoose. Services ask isDbUp(); nothing else touches the connection object.
import mongoose from "mongoose";
import { config } from "./env.js";
import { logger } from "./logger.js";

// Only fields declared in a schema can be used in query filters.
mongoose.set("strictQuery", true);
// Wraps filter values that look like operators ({ $ne: null }) in $eq, blocking NoSQL injection.
mongoose.set("sanitizeFilter", true);
// Production never builds indexes at start-up (a build can lock a big collection mid-traffic).
// scripts/migrateUsersV1.js builds them on purpose; elsewhere autoIndex stays on.
const autoIndex = config.NODE_ENV !== "production";
mongoose.set("autoIndex", autoIndex);

const log = logger.child({ component: "db" });
let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return; // connect may be called again (tests), but log each event once
  listenersAttached = true;
  mongoose.connection.on("connected", () =>
    log.info({ event: "db.connected" }, "MongoDB connected"),
  );
  mongoose.connection.on("disconnected", () =>
    log.warn({ event: "db.disconnected" }, "MongoDB disconnected"),
  );
  mongoose.connection.on("error", (err) => log.error({ event: "db.error", err }, "MongoDB error"));
}

/** Connects once; rejects if the server cannot be reached within ~5 s. */
export async function connectDb(uri) {
  attachListeners();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex });
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

/** readyState 1 means "connected" (0 disconnected, 2 connecting, 3 disconnecting). */
export function isDbUp() {
  return mongoose.connection.readyState === 1;
}
