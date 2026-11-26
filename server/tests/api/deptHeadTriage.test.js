// Decision M2-10: a dept_head lists their city's departments and sees and assigns their city's triage issues.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, makeIssue, seedIssueWorld } from "../helpers/issueWorld.js";

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
const triage = (over = {}) => makeIssue(w, { departmentId: null, queue: "triage", ...over });
const code = (res) => res.body.error?.code;

describe("GET /api/departments for issue:assign holders", () => {
  it("a dept_head gets their own city's departments", async () => {
    const res = await as(app, w.head).get(`/api/departments?cityId=${w.city._id}`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((d) => d.name)).toEqual(["Roads", "Water"]);
  });

  it("another city is 404 for a dept_head (the admin path keeps its 403)", async () => {
    const res = await as(app, w.head).get(`/api/departments?cityId=${w.city2._id}`);
    expect(res.status).toBe(404);
    expect(code(res)).toBe("NOT_FOUND");
    const admin = await as(app, w.admin).get(`/api/departments?cityId=${w.city2._id}`);
    expect(admin.status).toBe(403);
  });

  it("a citizen and a staff member are 403", async () => {
    for (const user of [w.citizen, w.staff]) {
      const res = await as(app, user).get(`/api/departments?cityId=${w.city._id}`);
      expect(res.status).toBe(403);
      expect(code(res)).toBe("FORBIDDEN");
    }
  });
});

describe("dept_head and city triage", () => {
  it("the queue shows their department and their city's triage, across cursor pages", async () => {
    const mine = await makeIssue(w);
    const cityTriage = await triage();
    await triage({ cityId: w.city2._id });
    await makeIssue(w, { departmentId: w.water._id });

    const first = await as(app, w.head).get("/api/staff/issues?limit=1");
    const second = await as(app, w.head).get(
      `/api/staff/issues?limit=1&cursor=${first.body.nextCursor}`,
    );
    const seen = [...first.body.items, ...second.body.items].map((i) => i.ticketId).sort();
    expect(seen).toEqual([mine.ticketId, cityTriage.ticketId].sort());
    expect(second.body.nextCursor).toBeNull();

    const staff = await as(app, w.staff).get("/api/staff/issues");
    expect(staff.body.items.map((i) => i.ticketId)).toEqual([mine.ticketId]);
  });

  it("assigns their city's triage issue; status on it stays out of scope", async () => {
    const issue = await triage();
    const status = await as(app, w.head)
      .patch(`/api/issues/${issue.ticketId}/status`)
      .send({ status: "rejected", note: "Duplicate report", version: 0 });
    expect(status.status).toBe(404);

    const res = await as(app, w.head)
      .patch(`/api/issues/${issue.ticketId}/assign`)
      .send({ departmentId: String(w.water._id), version: 0 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "assigned", department: { name: "Water" } });
  });

  it("another city's triage issue is 404", async () => {
    const issue = await triage({ cityId: w.city2._id });
    const res = await as(app, w.head)
      .patch(`/api/issues/${issue.ticketId}/assign`)
      .send({ departmentId: String(w.roads2._id), version: 0 });
    expect(res.status).toBe(404);
  });
});
