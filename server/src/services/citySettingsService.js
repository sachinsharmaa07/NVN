// City settings (decisions 2 and 3): which department handles each category, and how long it may take.
// city_admin: own city; super_admin: any city by id. Another city or a foreign department is the same 404.
// Changes apply to new reports only; issues already filed keep their expected-by date.
import { CategoryMapping } from "../models/CategoryMapping.js";
import { City } from "../models/City.js";
import { Department } from "../models/Department.js";
import { SlaPolicy } from "../models/SlaPolicy.js";
import { AppError } from "../utils/AppError.js";
import { CATEGORIES, DEFAULT_SLA_HOURS } from "../utils/categories.js";
import { record } from "./auditService.js";
import { assertActorScope, inTransaction, notFound, sameId, trusted } from "./adminUserSupport.js";

/** The city this actor may configure: their own, or (super_admin) the one asked for. */
async function cityFor(actor, cityId) {
  assertActorScope(actor, "user:promote");
  const id = actor.role === "super_admin" ? cityId : actor.cityId;
  if (!id || (cityId && !sameId(cityId, id))) throw notFound();
  const city = await City.findById(id, { name: 1 }).lean();
  if (!city) throw notFound();
  return city;
}

/** GET /api/admin/city-settings: one row per category, with where its hours come from. */
export async function getCitySettings(actor, { cityId }) {
  const city = await cityFor(actor, cityId);
  const [departments, mappings, policies] = await Promise.all([
    Department.find({ cityId: city._id }, { name: 1 }).sort({ name: 1 }).lean(),
    CategoryMapping.find({ cityId: city._id }).lean(),
    SlaPolicy.find({ cityId: trusted({ $in: [city._id, null] }) }).lean(),
  ]);
  const categories = CATEGORIES.map((category) => {
    const m = mappings.find((r) => r.category === category);
    const own = policies.find((p) => p.category === category && p.cityId);
    const national = policies.find((p) => p.category === category && !p.cityId);
    const hours = own ?? national ?? DEFAULT_SLA_HOURS[category];
    return {
      category,
      departmentId: m?.departmentId ? String(m.departmentId) : null,
      respondHours: hours.respondHours,
      resolveHours: hours.resolveHours,
      hoursFrom: own ? "city" : "national",
    };
  });
  return {
    city: { id: String(city._id), name: city.name },
    departments: departments.map((d) => ({ id: String(d._id), name: d.name })),
    categories,
  };
}

/** PUT /api/admin/city-settings/:category: route it and set the city's hours, audited in one transaction. */
export async function updateCategory(actor, category, body, ctx = {}) {
  const { cityId, departmentId, respondHours, resolveHours } = body;
  const city = await cityFor(actor, cityId);
  if (category === "other" && departmentId) {
    throw new AppError("VALIDATION_ERROR", 400, '"Other" always goes to the triage queue.');
  }
  if (resolveHours < respondHours) {
    throw new AppError(
      "VALIDATION_ERROR",
      400,
      "Fix-by hours can't be shorter than respond-by hours.",
    );
  }
  if (departmentId && !(await Department.exists({ _id: departmentId, cityId: city._id })))
    throw notFound();

  return inTransaction(async (session) => {
    const queue = departmentId ? "department" : "triage";
    const before = await CategoryMapping.findOne({ cityId: city._id, category })
      .session(session)
      .lean();
    await CategoryMapping.findOneAndUpdate(
      { cityId: city._id, category },
      { $set: { departmentId: departmentId ?? null, queue } },
      { upsert: true, runValidators: true, session },
    );
    await SlaPolicy.findOneAndUpdate(
      { cityId: city._id, category },
      { $set: { respondHours, resolveHours } },
      { upsert: true, runValidators: true, session },
    );
    await record(
      {
        actorType: "user",
        actorId: actor.id,
        actorRole: actor.role,
        action: "city.category_update",
        targetId: city._id,
        cityId: city._id,
        before: { category, departmentId: before?.departmentId ?? null, queue: before?.queue },
        after: { category, departmentId: departmentId ?? null, queue, respondHours, resolveHours },
        ip: ctx.ip,
        requestId: ctx.requestId,
      },
      { session },
    );
    return {
      category,
      departmentId: departmentId ?? null,
      respondHours,
      resolveHours,
      hoursFrom: "city",
    };
  });
}
