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
import { changeRole, listUsers, setStatus } from "../controllers/adminUserController.js";
import { idParams, listQuery, roleBody, statusBody } from "../validators/adminUsers.js";
import { none } from "../validators/me.js";

export const adminUserRoutes = Router();

// Admin data is personal data: never cached by a browser or proxy.
adminUserRoutes.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const who = [authenticate, loadUser, requireActive, requireVerifiedEmail];

adminUserRoutes.get(
  "/",
  ...who,
  requirePermission("user:read_scope"),
  adminReadLimit,
  validate({ query: listQuery, body: none }),
  listUsers,
);

adminUserRoutes.patch(
  "/:id/role",
  ...who,
  requirePermission("user:promote"),
  adminWriteLimit,
  validate({ params: idParams, query: none, body: roleBody }),
  changeRole,
);

adminUserRoutes.patch(
  "/:id/status",
  ...who,
  requirePermission("user:suspend"),
  adminWriteLimit,
  validate({ params: idParams, query: none, body: statusBody }),
  setStatus,
);
