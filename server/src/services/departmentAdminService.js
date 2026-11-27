// Custom departments beyond the seeded five (user:promote). A city_admin works in their own city, a
// super_admin in any city they name. Another city's department is the same 404 as a missing one.
// Rename only: deactivating would strand the users and category mappings that point at it.
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";
import { AppError } from "../utils/AppError.js";
import { record } from "./auditService.js";
import { inTransaction, notFound, sameId } from "./adminUserSupport.js";

const DUPLICATE_KEY = 11000;

const view = (d) => ({ id: String(d._id), cityId: String(d.cityId), name: d.name, code: d.code });

const audit = (actor, ctx, action, dept, before, after, session) =>
  record(
    {
      actorType: "user",
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetId: dept._id,
      cityId: dept.cityId,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    },
    { session },
  );

/** The city this actor may write in. Scope comes from the DB user, never trusted from the body. */
async function cityFor(actor, cityId) {
  if (actor.role !== "super_admin") {
    if (cityId && !sameId(cityId, actor.cityId)) throw notFound();
    return actor.cityId;
  }
  if (!cityId) throw new AppError("VALIDATION_ERROR", 400, "Choose the city for this department.");
  if (!(await City.exists({ _id: cityId }))) throw notFound();
  return cityId;
}

/** POST /api/admin/departments. A code already used in that city is 409. */
export async function createDepartment(actor, { cityId, name, code }, ctx = {}) {
  const city = await cityFor(actor, cityId);
  try {
    return await inTransaction(async (session) => {
      const [dept] = await Department.create([{ cityId: city, name, code }], { session });
      await audit(actor, ctx, "department.create", dept, undefined, { name, code }, session);
      return view(dept);
    });
  } catch (err) {
    if (err?.code !== DUPLICATE_KEY) throw err;
    throw new AppError(
      "CONFLICT",
      409,
      `A department with code ${code} already exists in this city.`,
    );
  }
}

/** PATCH /api/admin/departments/:id: rename. Scope is part of the query, so out of scope is a 404. */
export async function updateDepartment(actor, id, { name }, ctx = {}) {
  const scope = actor.role === "super_admin" ? {} : { cityId: actor.cityId };
  return inTransaction(async (session) => {
    const dept = await Department.findOne({ _id: id, ...scope }).session(session);
    if (!dept) throw notFound();
    const before = { name: dept.name };
    dept.name = name;
    await dept.save({ session });
    await audit(actor, ctx, "department.update", dept, before, { name }, session);
    return view(dept);
  });
}
