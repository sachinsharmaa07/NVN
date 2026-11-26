// Staff work queue. Scope (department or city) is applied in the service's query.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  loadUser,
  requireActive,
  requirePermission,
  requireVerifiedEmail,
} from "../middleware/access.js";
import { queue } from "../controllers/staffController.js";
import { staffQueueQuery } from "../validators/issues.js";

export const staffRoutes = Router();

staffRoutes.get(
  "/issues",
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("issue:read_scope"),
  validate({ query: staffQueueQuery }),
  queue,
);
