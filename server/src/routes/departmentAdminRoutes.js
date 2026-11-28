// Custom departments (user:promote: city_admin in their own city, super_admin in any). Reading them stays
// on GET /api/departments?cityId=.
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
import { create, update } from "../controllers/departmentAdminController.js";
import { none } from "../validators/me.js";
import {
  createDepartmentBody,
  departmentIdParams,
  updateDepartmentBody,
} from "../validators/departmentAdmin.js";

export const departmentAdminRoutes = Router();

departmentAdminRoutes.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const who = [
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("user:promote"),
  adminWriteLimit,
];

departmentAdminRoutes.post(
  "/",
  ...who,
  validate({ body: createDepartmentBody, query: none }),
  create,
);
departmentAdminRoutes.patch(
  "/:id",
  ...who,
  validate({ params: departmentIdParams, body: updateDepartmentBody, query: none }),
  update,
);
