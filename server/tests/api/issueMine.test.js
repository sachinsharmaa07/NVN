// GET /api/issues/mine and the timeline on GET /api/issues/:ticketId (M2 step 2).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, makeIssue, seedIssueWorld, HOUR } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");

useTestDb();
useFakeAuth0();
const app = createApp();

let w;
beforeEach(async () => {
  w = await seedIssueWorld();
});

describe("GET /api/issues/mine", () => {
  it("lists only my issues, newest first, with cursor pages", async () => {
    const t0 = Date.parse("2026-11-20T00:00:00Z");
    const mine = [];
    for (let i = 0; i < 3; i += 1)
      mine.push(await makeIssue(w, { createdAt: new Date(t0 + i * HOUR) }));
    await makeIssue(w, { reporterId: w.citizen._id });

    const first = await as(app, w.reporter).get("/api/issues/mine?limit=2");
    expect(first.status).toBe(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    expect(first.body.items.map((i) => i.ticketId)).toEqual([mine[2].ticketId, mine[1].ticketId]);
    expect(first.body.items[0]).toMatchObject({
      status: "submitted",
      slaState: "on_track",
      version: 0,
    });
    expect(first.body.items[0]).not.toHaveProperty("reporterId");

    const next = await as(app, w.reporter).get(
      `/api/issues/mine?limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(next.body.items.map((i) => i.ticketId)).toEqual([mine[0].ticketId]);
    expect(next.body.nextCursor).toBeNull();
  });

  it("refuses a limit above 50, an unknown key and a bad cursor", async () => {
    for (const q of ["limit=51", "foo=1", "cursor=!!"]) {
      const res = await as(app, w.reporter).get(`/api/issues/mine?${q}`);
      expect(res.status).toBe(400);
    }
  });

  it("is 403 for a role without issue:read_own", async () => {
    const res = await as(app, w.state).get("/api/issues/mine");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("GET /api/issues/:ticketId timeline", () => {
  it("returns each step with the actor's role and note, never an id or email", async () => {
    const at = new Date("2026-11-20T00:00:00Z");
    const issue = await makeIssue(w, {
      status: "assigned",
      statusHistory: [
        { status: "submitted", at, by: w.reporter._id, role: "citizen" },
        { status: "assigned", at, by: w.staff._id, role: "staff", note: "On it" },
      ],
    });
    const res = await as(app, w.reporter).get(`/api/issues/${issue.ticketId}`);
    expect(res.status).toBe(200);
    expect(res.body.timeline).toEqual([
      { status: "submitted", at: at.toISOString(), role: "citizen", note: null },
      { status: "assigned", at: at.toISOString(), role: "staff", note: "On it" },
    ]);
    expect(JSON.stringify(res.body)).not.toContain(String(w.staff._id));
    expect(JSON.stringify(res.body)).not.toContain(w.staff.email);
  });

  it("is the same 404 for someone else's issue", async () => {
    const issue = await makeIssue(w);
    const res = await as(app, w.citizen).get(`/api/issues/${issue.ticketId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
