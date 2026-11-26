// In-app notifications (M2 step 8): only the signed-in user's own rows, matched on userId in the service.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { loadUser, requireActive, requirePermission } from "../middleware/access.js";
import { list, read } from "../controllers/notificationController.js";
import { none } from "../validators/me.js";
import { listNotificationsQuery, markReadBody } from "../validators/notifications.js";

export const notificationRoutes = Router();

const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
const chain = [
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requirePermission("profile:read_own"),
];

notificationRoutes.get("/", ...chain, validate({ query: listNotificationsQuery }), list);
notificationRoutes.post("/read", ...chain, validate({ body: markReadBody, query: none }), read);
