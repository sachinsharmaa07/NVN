// GET /api/admin/city-settings and PUT /api/admin/city-settings/:category (M3 step 4).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, seedIssueWorld } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");
const { CategoryMapping } = await import("../../src/models/CategoryMapping.js");
const { resolveHours } = await import("../../src/services/issueService.js");

useTestDb();
useFakeAuth0();
const app = createApp();

let w;
beforeEach(async () => {
  w = await seedIssueWorld();
  await CategoryMapping.create({
    cityId: w.city._id,
    category: "pothole",
    departmentId: w.roads._id,
    queue: "department",
  });
});

const put = (user, category, body) =>
  as(app, user).put(`/api/admin/city-settings/${category}`).send(body);

describe("GET /api/admin/city-settings", () => {
  it("shows every category with its department and where its hours come from", async () => {
    const res = await as(app, w.admin).get("/api/admin/city-settings");
    expect(res.status).toBe(200);
    expect(res.body.city.name).toBe("Kapurthala");
    expect(res.body.departments.map((d) => d.name)).toEqual(["Roads", "Water"]);
    const pothole = res.body.categories.find((c) => c.category === "pothole");
    expect(pothole).toEqual({
      category: "pothole",
      departmentId: String(w.roads._id),
      respondHours: 24,
      resolveHours: 168,
      hoursFrom: "national",
    });
    expect(res.body.categories).toHaveLength(6);
  });

  it("is city-scoped: another city is 404, a citizen or dept_head 403", async () => {
    const other = await as(app, w.admin).get(`/api/admin/city-settings?cityId=${w.city2._id}`);
    expect(other.status).toBe(404);
    const root = await as(app, w.root).get(`/api/admin/city-settings?cityId=${w.city2._id}`);
    expect(root.body.city.name).toBe("Pune");
    expect((await as(app, w.citizen).get("/api/admin/city-settings")).status).toBe(403);
    expect((await as(app, w.head).get("/api/admin/city-settings")).status).toBe(403);
  });
});

describe("PUT /api/admin/city-settings/:category", () => {
  it("routes a category and sets the city's hours, audited, and new reports use them", async () => {
    const res = await put(w.admin, "pothole", {
      departmentId: String(w.water._id),
      respondHours: 12,
      resolveHours: 96,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      departmentId: String(w.water._id),
      resolveHours: 96,
      hoursFrom: "city",
    });
    expect(await resolveHours(w.city._id, "pothole")).toBe(96);
    expect(await resolveHours(w.city2._id, "pothole")).toBe(168); // other cities keep the national default
    const audit = await AuditLog.findOne({ action: "city.category_update" }).lean();
    expect(audit).toMatchObject({
      targetType: "city",
      actorRole: "city_admin",
      before: { category: "pothole", departmentId: w.roads._id, queue: "department" },
      after: { category: "pothole", queue: "department", respondHours: 12, resolveHours: 96 },
    });
  });

  it("sends a category to triage with departmentId null", async () => {
    await put(w.admin, "pothole", { departmentId: null, respondHours: 24, resolveHours: 168 });
    expect(
      await CategoryMapping.findOne({ cityId: w.city._id, category: "pothole" }).lean(),
    ).toMatchObject({
      departmentId: null,
      queue: "triage",
    });
  });

  it("refuses a department of another city (404), 'other' with a department, and hours out of order", async () => {
    const foreign = await put(w.admin, "pothole", {
      departmentId: String(w.roads2._id),
      respondHours: 24,
      resolveHours: 48,
    });
    expect(foreign.status).toBe(404);
    const other = await put(w.admin, "other", {
      departmentId: String(w.roads._id),
      respondHours: 24,
      resolveHours: 48,
    });
    expect(other.status).toBe(400);
    const order = await put(w.admin, "pothole", {
      departmentId: null,
      respondHours: 48,
      resolveHours: 24,
    });
    expect(order.status).toBe(400);
    const extra = await put(w.admin, "pothole", {
      departmentId: null,
      respondHours: 24,
      resolveHours: 48,
      queue: "department",
    });
    expect(extra.status).toBe(400);
    expect(await AuditLog.countDocuments({ action: "city.category_update" })).toBe(0);
  });
});
