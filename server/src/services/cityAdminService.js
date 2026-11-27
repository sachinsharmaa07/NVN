// City onboarding (city:onboard, super_admin only): add a city, open or pause it, and give it the default
// departments and category map. Every change is audited in its transaction. Pincodes still come from the
// import script; a city with no pincodes simply has nothing to report into yet.
import { City } from "../models/City.js";
import { AppError } from "../utils/AppError.js";
import { record } from "./auditService.js";
import { inTransaction, notFound } from "./adminUserSupport.js";
import { seedDepartments } from "./departmentSeedService.js";

const view = (c) => ({
  id: String(c._id),
  name: c.name,
  code: c.code,
  stateCode: c.stateCode,
  status: c.status,
});

const audit = (actor, ctx, action, city, before, after, session) =>
  record(
    {
      actorType: "user",
      actorId: actor.id,
      actorRole: actor.role,
      action,
      targetId: city._id,
      cityId: city._id,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    },
    { session },
  );

/** POST /api/admin/cities: a new city in "onboarding", with its departments and category map. */
export async function createCity(actor, { name, code, stateCode }, ctx = {}) {
  if (await City.exists({ code })) {
    throw new AppError("CONFLICT", 409, `A city with code ${code} already exists.`);
  }
  const city = await inTransaction(async (session) => {
    const [row] = await City.create([{ name, code, stateCode, status: "onboarding" }], { session });
    await audit(
      actor,
      ctx,
      "city.create",
      row,
      undefined,
      { name, code, stateCode, status: "onboarding" },
      session,
    );
    return row;
  });
  // Outside the transaction: the seed is idempotent, so a failure here is fixed by a rerun (PATCH or script).
  const seeded = await seedDepartments({ apply: true, cityCode: code });
  return { ...view(city), departmentsCreated: seeded.departmentsCreated };
}

/** PATCH /api/admin/cities/:id: rename it, or move it between onboarding and active. */
export async function updateCity(actor, id, changes, ctx = {}) {
  return inTransaction(async (session) => {
    const city = await City.findById(id).session(session);
    if (!city) throw notFound();
    const before = { name: city.name, status: city.status };
    Object.assign(city, changes);
    await city.save({ session });
    await audit(
      actor,
      ctx,
      "city.update",
      city,
      before,
      { name: city.name, status: city.status },
      session,
    );
    return view(city);
  });
}
