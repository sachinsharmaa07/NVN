// GET /api/staff/issues (M2 step 3): scope per role, filters, SLA order, cursor.
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

const T0 = Date.parse("2026-11-20T00:00:00Z");
const due = (h) => new Date(T0 + h * HOUR);
let w;
let issues;
beforeEach(async () => {
  w = await seedIssueWorld();
  issues = {
    late: await makeIssue(w, { expectedBy: due(10), slaState: "at_risk" }),
    soon: await makeIssue(w, { expectedBy: due(5) }),
    water: await makeIssue(w, { departmentId: w.water._id, expectedBy: due(1) }),
    triage: await makeIssue(w, {
      departmentId: null,
      queue: "triage",
      category: "other",
      expectedBy: due(2),
    }),
    closed: await makeIssue(w, { status: "closed", expectedBy: due(0) }),
    elsewhere: await makeIssue(w, {
      cityId: w.city2._id,
      departmentId: w.roads2._id,
      expectedBy: due(3),
    }),
  };
});

const ids = (res) => res.body.items.map((i) => i.ticketId);
const t = (...keys) => keys.map((k) => issues[k].ticketId);

describe("GET /api/staff/issues", () => {
  it("staff see their department's open issues, soonest due first", async () => {
    const res = await as(app, w.staff).get("/api/staff/issues");
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(t("soon", "late"));
    expect(res.body.items[0]).toMatchObject({
      departmentId: String(w.roads._id),
      location: { lat: 31.38, lng: 75.38 },
      version: 0,
    });
    expect(res.body.items[0]).not.toHaveProperty("reporterId");
  });

  it("dept_head sees the same department; other department staff see only theirs", async () => {
    expect(ids(await as(app, w.head).get("/api/staff/issues"))).toEqual(t("soon", "late"));
    expect(ids(await as(app, w.waterStaff).get("/api/staff/issues"))).toEqual(t("water"));
  });

  it("city_admin sees the whole city with triage; queue=triage narrows it", async () => {
    const all = await as(app, w.admin).get("/api/staff/issues");
    expect(ids(all)).toEqual(t("water", "triage", "soon", "late"));
    const triage = await as(app, w.admin).get("/api/staff/issues?queue=triage");
    expect(ids(triage)).toEqual(t("triage"));
  });

  it("state_officer sees their state's cities; super_admin sees all", async () => {
    expect(ids(await as(app, w.state).get("/api/staff/issues"))).toEqual(
      t("water", "triage", "soon", "late"),
    );
    expect(ids(await as(app, w.root).get("/api/staff/issues"))).toEqual(
      t("water", "triage", "elsewhere", "soon", "late"),
    );
  });

  it("filters by status, sla and category", async () => {
    const closed = await as(app, w.staff).get("/api/staff/issues?status=closed");
    expect(ids(closed)).toEqual(t("closed"));
    const risky = await as(app, w.staff).get("/api/staff/issues?sla=at_risk");
    expect(ids(risky)).toEqual(t("late"));
    const other = await as(app, w.admin).get("/api/staff/issues?category=other");
    expect(ids(other)).toEqual(t("triage"));
  });

  it("pages with a cursor in the same order", async () => {
    const first = await as(app, w.admin).get("/api/staff/issues?limit=3");
    expect(ids(first)).toEqual(t("water", "triage", "soon"));
    const next = await as(app, w.admin).get(
      `/api/staff/issues?limit=3&cursor=${first.body.nextCursor}`,
    );
    expect(ids(next)).toEqual(t("late"));
    expect(next.body.nextCursor).toBeNull();
  });

  it("is 403 for a citizen and for a dept_head without MFA", async () => {
    const citizen = await as(app, w.citizen).get("/api/staff/issues");
    expect(citizen.status).toBe(403);
    expect(citizen.body.error.code).toBe("FORBIDDEN");
    const noMfa = await as(app, w.head, { mfa: undefined }).get("/api/staff/issues");
    expect(noMfa.body.error.code).toBe("MFA_REQUIRED");
  });

  it("refuses unknown filters and bad values", async () => {
    for (const q of ["status=open", "sla=late", "limit=0", "reporterId=x"]) {
      expect((await as(app, w.staff).get(`/api/staff/issues?${q}`)).status).toBe(400);
    }
  });
});
