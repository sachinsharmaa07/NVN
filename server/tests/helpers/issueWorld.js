// M2 API tests: one city with two departments, a second city, a user of every working role, and issues
// inserted straight through the model (no Cloudinary, no submit flow). Call after useTestDb().
import { randomUUID } from "node:crypto";
import request from "supertest";
import { City } from "../../src/models/City.js";
import { Department } from "../../src/models/Department.js";
import { Issue } from "../../src/models/Issue.js";
import { SlaPolicy } from "../../src/models/SlaPolicy.js";
import { atRiskAt, expectedBy } from "../../src/utils/expectedBy.js";
import { seedUser, tokenFor, bearer } from "./testDb.js";

export const HOUR = 3600_000;
export const PHOTO = "nivaran/test/reports/after1";

export async function seedIssueWorld() {
  const [city, city2] = await City.create([
    { name: "Kapurthala", code: "PB-KAPURTHALA", stateCode: "PB" },
    { name: "Pune", code: "MH-PUNE", stateCode: "MH" },
  ]);
  const [roads, water, roads2] = await Department.create([
    { cityId: city._id, name: "Roads", code: "ROADS" },
    { cityId: city._id, name: "Water", code: "WATER" },
    { cityId: city2._id, name: "Roads", code: "ROADS" },
  ]);
  await SlaPolicy.create({
    category: "pothole",
    cityId: null,
    respondHours: 24,
    resolveHours: 168,
  });
  const inRoads = { cityId: city._id, departmentId: roads._id };
  const users = {
    reporter: await seedUser("citizen"),
    citizen: await seedUser("citizen"),
    staff: await seedUser("staff", inRoads),
    waterStaff: await seedUser("staff", { cityId: city._id, departmentId: water._id }),
    head: await seedUser("dept_head", inRoads),
    admin: await seedUser("city_admin", { cityId: city._id }),
    admin2: await seedUser("city_admin", { cityId: city2._id }),
    state: await seedUser("state_officer", { stateCode: "PB" }),
    root: await seedUser("super_admin"),
  };
  return { city, city2, roads, water, roads2, ...users };
}

let n = 0;
/** Inserts an issue (a Roads pothole in `world.city` by `world.reporter` unless overridden). */
export async function makeIssue(world, over = {}) {
  n += 1;
  const at = over.createdAt ?? new Date();
  const due = over.expectedBy ?? expectedBy(at, 168);
  const doc = await Issue.create({
    ticketId: `NIV-2026-${String(n).padStart(6, "0")}`,
    reporterId: world.reporter._id,
    cityId: world.city._id,
    pincode: "144601",
    location: { type: "Point", coordinates: [75.38, 31.38] },
    precision: "approx",
    category: "pothole",
    departmentId: world.roads._id,
    queue: "department",
    title: "Deep pothole",
    description: "A deep pothole outside the bus stand, two feet wide.",
    status: "submitted",
    statusHistory: [{ status: "submitted", at, by: world.reporter._id, role: "citizen" }],
    expectedBy: due,
    atRiskAt: atRiskAt(at, due),
    idempotencyKey: randomUUID(),
    createdAt: at,
    ...over,
  });
  return doc.toObject();
}

/** Supertest call as `user`: call(app, user).patch(url).send(body). */
export const as = (app, user, claims) => {
  const auth = bearer(tokenFor(user, claims));
  return {
    get: (url) => request(app).get(url).set(auth),
    post: (url) => request(app).post(url).set(auth),
    patch: (url) => request(app).patch(url).set(auth),
  };
};
