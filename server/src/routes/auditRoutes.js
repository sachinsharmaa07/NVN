// The audit feed (audit:read: city_admin for their city, super_admin for all). Read only; no route writes it.
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
import { audit } from "../controllers/auditController.js";
import { none } from "../validators/me.js";
import { auditQuery } from "../validators/audit.js";

export const auditRoutes = Router();

auditRoutes.get(
  "/",
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("audit:read"),
  adminReadLimit,
  validate({ query: auditQuery, body: none }),
  audit,
);
