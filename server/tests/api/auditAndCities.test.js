// GET /api/admin/audit and POST/PATCH /api/admin/cities.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, seedIssueWorld } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { record } = await import("../../src/services/auditService.js");
const { City } = await import("../../src/models/City.js");
const { Department } = await import("../../src/models/Department.js");
const { CategoryMapping } = await import("../../src/models/CategoryMapping.js");

useTestDb();
useFakeAuth0();
const app = createApp();

let w;
beforeEach(async () => {
  w = await seedIssueWorld();
});

const row = (cityId, at) =>
  record({
    actorType: "system",
    actorLabel: "test",
    action: "issue.status_change",
    targetId: w.city._id,
    cityId,
    after: { ticketId: "NIV-2026-000001", status: "assigned" },
    at,
  });

describe("GET /api/admin/audit", () => {
  it("shows a city admin their city only, newest first, in cursor pages", async () => {
    await row(w.city._id, new Date("2026-11-20T00:00:00Z"));
    await row(w.city._id, new Date("2026-11-21T00:00:00Z"));
    await row(w.city2._id, new Date("2026-11-22T00:00:00Z"));
    const first = await as(app, w.admin).get("/api/admin/audit?limit=1");
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.items[0]).toMatchObject({
      action: "issue.status_change",
      actor: { type: "system", label: "test" },
      at: "2026-11-21T00:00:00.000Z",
    });
    const next = await as(app, w.admin).get(
      `/api/admin/audit?limit=1&cursor=${first.body.nextCursor}`,
    );
    expect(next.body.items[0].at).toBe("2026-11-20T00:00:00.000Z");
    expect(next.body.nextCursor).toBeNull();
    expect((await as(app, w.root).get("/api/admin/audit")).body.items).toHaveLength(3);
  });

  it("is 403 for roles without audit:read and refuses unknown filters", async () => {
    expect((await as(app, w.head).get("/api/admin/audit")).status).toBe(403);
    expect((await as(app, w.admin).get("/api/admin/audit?action=user.delete")).status).toBe(400);
  });
});

describe("/api/admin/cities", () => {
  it("lets a super admin add a city with its departments and map, audited", async () => {
    const res = await as(app, w.root)
      .post("/api/admin/cities")
      .send({ name: "Jalandhar", code: "pb-jalandhar", stateCode: "PB" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: "PB-JALANDHAR",
      status: "onboarding",
      departmentsCreated: 5,
    });
    expect(await Department.countDocuments({ cityId: res.body.id })).toBe(5);
    expect(await CategoryMapping.countDocuments({ cityId: res.body.id })).toBe(6);
    const audit = await as(app, w.root).get("/api/admin/audit?action=city.create");
    expect(audit.body.items[0].after).toEqual({
      name: "Jalandhar",
      code: "PB-JALANDHAR",
      stateCode: "PB",
      status: "onboarding",
    });
  });

  it("opens a city, and refuses a duplicate code or a city admin", async () => {
    const res = await as(app, w.root)
      .patch(`/api/admin/cities/${w.city2._id}`)
      .send({ status: "active" });
    expect(res.body.status).toBe("active");
    expect((await City.findById(w.city2._id).lean()).status).toBe("active");
    const dup = await as(app, w.root)
      .post("/api/admin/cities")
      .send({ name: "Kapurthala", code: "PB-KAPURTHALA", stateCode: "PB" });
    expect(dup.status).toBe(409);
    const admin = await as(app, w.admin)
      .post("/api/admin/cities")
      .send({ name: "Phagwara", code: "PB-PHAGWARA", stateCode: "PB" });
    expect(admin.status).toBe(403);
  });
});
