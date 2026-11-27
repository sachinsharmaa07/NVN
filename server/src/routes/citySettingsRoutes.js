// City settings for city admins (M3 step 4): category routing and SLA hours. Same guards and limits as
// the other admin routes; the city scope is applied in the service.
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
import { settings, update } from "../controllers/citySettingsController.js";
import { none } from "../validators/me.js";
import { categoryBody, categoryParams, settingsQuery } from "../validators/citySettings.js";

export const citySettingsRoutes = Router();

citySettingsRoutes.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const who = [
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("user:promote"),
];

citySettingsRoutes.get(
  "/",
  ...who,
  adminReadLimit,
  validate({ query: settingsQuery, body: none }),
  settings,
);
citySettingsRoutes.put(
  "/:category",
  ...who,
  adminWriteLimit,
  validate({ params: categoryParams, query: none, body: categoryBody }),
  update,
);
