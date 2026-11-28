// City onboarding for super admins (city:onboard): list, add, open or pause cities, and see waitlist demand
// (adminWaitlistRoutes, mounted at /api/admin/waitlist). The role dialog's picker stays on GET /api/cities.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  loadUser,
  requireActive,
  requirePermission,
  requireVerifiedEmail,
} from "../middleware/access.js";
import { adminReadLimit, adminWriteLimit } from "../middleware/userRateLimit.js";
import { create, demand, list, update } from "../controllers/cityAdminController.js";
import { none } from "../validators/me.js";
import {
  adminCitiesQuery,
  cityIdParams,
  createCityBody,
  updateCityBody,
  waitlistDemandQuery,
} from "../validators/cityAdmin.js";

export const cityAdminRoutes = Router();

export const adminWaitlistRoutes = Router();

const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
cityAdminRoutes.use(noStore);
adminWaitlistRoutes.use(noStore);

const who = [
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("city:onboard"),
];

cityAdminRoutes.get("/", ...who, adminReadLimit, validate({ query: adminCitiesQuery }), list);
cityAdminRoutes.post(
  "/",
  ...who,
  adminWriteLimit,
  validate({ body: createCityBody, query: none }),
  create,
);
cityAdminRoutes.patch(
  "/:id",
  ...who,
  adminWriteLimit,
  validate({ params: cityIdParams, body: updateCityBody, query: none }),
  update,
);

adminWaitlistRoutes.get(
  "/",
  ...who,
  adminReadLimit,
  validate({ query: waitlistDemandQuery }),
  demand,
);
