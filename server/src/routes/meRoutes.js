import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { loadUser, requireActive, requirePermission } from "../middleware/access.js";
import { getMe, patchMe } from "../controllers/meController.js";
import { none, patchMeBody } from "../validators/me.js";

export const meRoutes = Router();

// Personal data: browsers and proxies must not keep a copy.
meRoutes.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Chain on every route: token -> user from the DB -> not suspended -> permission -> validation.
// Neither needs a verified email: an unverified user must still be able to read and fix their own profile.
const who = [authenticate, loadUser, requireActive];

meRoutes.get("/", ...who, requirePermission("profile:read_own"), validate({ query: none }), getMe);

meRoutes.patch(
  "/",
  ...who,
  requirePermission("profile:update_own"),
  validate({ body: patchMeBody, query: none }),
  patchMe,
);
