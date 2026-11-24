// Live check against the real test database (a replica set started by tests/setup/globalSetup.js,
// or MONGODB_URI_TEST). Never skipped: if there is no database, the run fails and says why.
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import mongoose from "mongoose";
import { inject } from "vitest";
import { connectDb, disconnectDb, isDbUp } from "../../src/config/db.js";

describe("MongoDB (live test database)", () => {
  beforeAll(() => {
    const { uri, error } = inject("mongo");
    if (!uri) throw new Error(`No test database. Reason: ${error}`);
  });
  afterAll(() => disconnectDb());

  it("connects and answers a ping", async () => {
    await connectDb(inject("mongo").uri);
    expect(isDbUp()).toBe(true);
    const reply = await mongoose.connection.db.admin().ping();
    expect(reply.ok).toBe(1);
  });

  it("is a replica set, so transactions work", async () => {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    expect(hello.setName).toBeTruthy();
    expect(mongoose.connection.name.endsWith("_test")).toBe(true);
  });
});
