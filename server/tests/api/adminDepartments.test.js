// POST /api/admin/departments and PATCH /api/admin/departments/:id: custom departments, scoped and audited.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, seedIssueWorld } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { Department } = await import("../../src/models/Department.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");

useTestDb();
useFakeAuth0();
const app = createApp();

let w;
beforeEach(async () => {
  w = await seedIssueWorld(); // Kapurthala: Roads, Water; Pune: Roads
});

const create = (user, body) => as(app, user).post("/api/admin/departments").send(body);
const rename = (user, id, body) => as(app, user).patch(`/api/admin/departments/${id}`).send(body);
const NOT_FOUND = {
  error: { code: "NOT_FOUND", message: "The requested resource was not found." },
};

describe("POST /api/admin/departments", () => {
  it("lets a city admin add one to their own city, audited in the same city", async () => {
    const res = await create(w.admin, { name: "Parks", code: "parks" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      cityId: String(w.city._id),
      name: "Parks",
      code: "PARKS",
    });
    const audit = await AuditLog.findOne({ action: "department.create" }).lean();
    expect(audit).toMatchObject({ targetType: "department", actorRole: "city_admin" });
    expect(String(audit.cityId)).toBe(String(w.city._id));
    expect(audit.after).toEqual({ name: "Parks", code: "PARKS" });
  });

  it("is 404 for a city admin naming another city, and writes nothing", async () => {
    const res = await create(w.admin, {
      cityId: String(w.city2._id),
      name: "Parks",
      code: "PARKS",
    });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
    expect(await Department.countDocuments({ code: "PARKS" })).toBe(0);
  });

  it("needs a cityId from a super admin, and an existing city", async () => {
    expect((await create(w.root, { name: "Parks", code: "PARKS" })).status).toBe(400);
    const missing = "0".repeat(24);
    expect((await create(w.root, { cityId: missing, name: "Parks", code: "PARKS" })).status).toBe(
      404,
    );
    const ok = await create(w.root, { cityId: String(w.city2._id), name: "Parks", code: "PARKS" });
    expect(ok.status).toBe(201);
    expect(ok.body.cityId).toBe(String(w.city2._id));
  });

  it("is 409 for a code the city already has, and keeps the existing row", async () => {
    const res = await create(w.admin, { name: "Roads again", code: "ROADS" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
    expect((await Department.findById(w.roads._id).lean()).name).toBe("Roads");
    expect(await AuditLog.countDocuments({ action: "department.create" })).toBe(0);
  });

  it("refuses bad codes, extra keys, other roles and a missing MFA claim", async () => {
    expect((await create(w.admin, { name: "Parks", code: "parks-1" })).status).toBe(400);
    expect((await create(w.admin, { name: "Parks", code: "P" })).status).toBe(400);
    expect((await create(w.admin, { name: "Parks", code: "PARKS", isActive: true })).status).toBe(
      400,
    );
    expect((await create(w.head, { name: "Parks", code: "PARKS" })).status).toBe(403);
    expect((await create(w.state, { name: "Parks", code: "PARKS" })).status).toBe(403);
    const noMfa = await as(app, w.admin, { mfa: undefined })
      .post("/api/admin/departments")
      .send({ name: "Parks", code: "PARKS" });
    expect(noMfa.body.error.code).toBe("MFA_REQUIRED");
  });
});

describe("PATCH /api/admin/departments/:id", () => {
  it("renames one, audited with before and after", async () => {
    const res = await rename(w.admin, w.roads._id, { name: "Roads and Bridges" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Roads and Bridges", code: "ROADS" });
    const audit = await AuditLog.findOne({ action: "department.update" }).lean();
    expect(audit.before).toEqual({ name: "Roads" });
    expect(audit.after).toEqual({ name: "Roads and Bridges" });
  });

  it("is the same 404 for another city's department and a missing one", async () => {
    const other = await rename(w.admin, w.roads2._id, { name: "Mine now" });
    const missing = await rename(w.admin, "0".repeat(24), { name: "Mine now" });
    expect(other.status).toBe(404);
    expect(other.body).toEqual(NOT_FOUND);
    expect(missing.body).toEqual(other.body);
    expect((await Department.findById(w.roads2._id).lean()).name).toBe("Roads");
  });

  it("lets a super admin rename in any city, and only the name", async () => {
    expect((await rename(w.root, w.roads2._id, { name: "Pune Roads" })).status).toBe(200);
    expect((await rename(w.root, w.roads2._id, { code: "X1" })).status).toBe(400);
  });
});
