// Pickers for the role dialog: GET /api/cities and GET /api/departments?cityId=.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  loadUser,
  requireActive,
  requirePermission,
  requireVerifiedEmail,
} from "../middleware/access.js";
import { adminReadLimit } from "../middleware/userRateLimit.js";
import { listCities, listDepartments } from "../controllers/geoController.js";
import { departmentsQuery } from "../validators/geo.js";
import { none } from "../validators/me.js";

export const geoRoutes = Router();

// Per route (not router.use): this router is mounted at /api, so a router-level hook would hit every route.
const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
const who = [noStore, authenticate, loadUser, requireActive, requireVerifiedEmail];

geoRoutes.get(
  "/cities",
  ...who,
  requirePermission("user:promote"),
  adminReadLimit,
  validate({ query: none }),
  listCities,
);

geoRoutes.get(
  "/departments",
  ...who,
  requirePermission("user:promote"),
  adminReadLimit,
  validate({ query: departmentsQuery }),
  listDepartments,
);
