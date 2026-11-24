// Live check against the real test database. Skipped when MONGODB_URI_TEST is not set (e.g. a fork's CI).
import { describe, it, expect, afterAll } from "vitest";
import mongoose from "mongoose";
import { config } from "../../src/config/env.js";
import { connectDb, disconnectDb, isDbUp } from "../../src/config/db.js";

const uri = config.MONGODB_URI_TEST;
const SKIP_MESSAGE = "MONGODB_URI_TEST not set: skipping live DB test";
// Written straight to stderr because Vitest hides console output from files whose tests all skip.
if (!uri) process.stderr.write(`\n${SKIP_MESSAGE}\n`);

// The suite title carries the reason too, so it shows up in Vitest's list of skipped tests.
describe.skipIf(!uri)(uri ? "MongoDB (live, MONGODB_URI_TEST)" : SKIP_MESSAGE, () => {
  afterAll(() => disconnectDb());

  it("connects and answers a ping", async () => {
    await connectDb(uri);
    expect(isDbUp()).toBe(true);
    const reply = await mongoose.connection.db.admin().ping();
    expect(reply.ok).toBe(1);
  });
});
