// City onboarding for super admins (city:onboard). Reading cities stays on GET /api/cities.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  loadUser,
  requireActive,
  requirePermission,
  requireVerifiedEmail,
} from "../middleware/access.js";
import { adminWriteLimit } from "../middleware/userRateLimit.js";
import { create, update } from "../controllers/cityAdminController.js";
import { none } from "../validators/me.js";
import { cityIdParams, createCityBody, updateCityBody } from "../validators/cityAdmin.js";

export const cityAdminRoutes = Router();

cityAdminRoutes.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const who = [
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("city:onboard"),
  adminWriteLimit,
];

cityAdminRoutes.post("/", ...who, validate({ body: createCityBody, query: none }), create);
cityAdminRoutes.patch(
  "/:id",
  ...who,
  validate({ params: cityIdParams, body: updateCityBody, query: none }),
  update,
);
