// GET /api/notifications and POST /api/notifications/read (M2 step 8).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, makeIssue, seedIssueWorld, HOUR } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { Notification, NOTIFICATION_TTL_SECONDS } = await import("../../src/models/Notification.js");

useTestDb();
useFakeAuth0();
const app = createApp();

const T0 = Date.parse("2026-11-20T00:00:00Z");
let w;
let mine;
beforeEach(async () => {
  w = await seedIssueWorld();
  const issue = await makeIssue(w);
  const row = (userId, h, status) => ({
    userId,
    issueId: issue._id,
    ticketId: issue.ticketId,
    type: "status_changed",
    status,
    createdAt: new Date(T0 + h * HOUR),
  });
  mine = await Notification.insertMany([
    row(w.reporter._id, 1, "assigned"),
    row(w.reporter._id, 2, "in_progress"),
    row(w.reporter._id, 3, "resolved"),
  ]);
  await Notification.create(row(w.citizen._id, 4, "assigned"));
});

describe("GET /api/notifications", () => {
  it("lists only mine, newest first, with cursor pages and the unread count", async () => {
    const first = await as(app, w.reporter).get("/api/notifications?limit=2");
    expect(first.status).toBe(200);
    expect(first.body.items.map((n) => n.status)).toEqual(["resolved", "in_progress"]);
    expect(first.body.items[0]).toEqual({
      id: String(mine[2]._id),
      type: "status_changed",
      ticketId: mine[2].ticketId,
      status: "resolved",
      read: false,
      createdAt: new Date(T0 + 3 * HOUR).toISOString(),
    });
    expect(first.body.unread).toBe(3);
    const next = await as(app, w.reporter).get(
      `/api/notifications?limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(next.body.items.map((n) => n.status)).toEqual(["assigned"]);
    expect(next.body.nextCursor).toBeNull();
  });

  it("refuses unknown keys and a limit above 50", async () => {
    for (const q of ["limit=51", "userId=x"]) {
      expect((await as(app, w.reporter).get(`/api/notifications?${q}`)).status).toBe(400);
    }
  });

  it("expires rows after 90 days (TTL index)", async () => {
    const idx = (await Notification.collection.indexes()).find((i) => i.expireAfterSeconds);
    expect(idx).toMatchObject({
      key: { createdAt: 1 },
      expireAfterSeconds: NOTIFICATION_TTL_SECONDS,
    });
    expect(NOTIFICATION_TTL_SECONDS).toBe(90 * 24 * 3600);
  });
});

describe("POST /api/notifications/read", () => {
  it("marks the given ids read; someone else's id is not touched", async () => {
    const theirs = await Notification.findOne({ userId: w.citizen._id }).lean();
    const res = await as(app, w.reporter)
      .post("/api/notifications/read")
      .send({ ids: [String(mine[0]._id), String(theirs._id)] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updated: 1 });
    expect((await Notification.findById(theirs._id).lean()).readAt).toBeNull();
  });

  it("marks all of mine read without ids, and is idempotent", async () => {
    const send = () => as(app, w.reporter).post("/api/notifications/read").send({});
    expect((await send()).body).toEqual({ updated: 3 });
    expect((await send()).body).toEqual({ updated: 0 });
    expect((await as(app, w.reporter).get("/api/notifications")).body.unread).toBe(0);
  });

  it("refuses bad ids and extra keys", async () => {
    for (const body of [{ ids: ["nope"] }, { ids: [] }, { all: true }]) {
      expect((await as(app, w.reporter).post("/api/notifications/read").send(body)).status).toBe(
        400,
      );
    }
  });
});
