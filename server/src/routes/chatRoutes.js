// Help chat (DESIGN.md 5): signed in, 20 messages per user per 10 minutes, nothing stored.
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { loadUser, requireActive, requirePermission } from "../middleware/access.js";
import { userRateLimit } from "../middleware/userRateLimit.js";
import { chat } from "../controllers/chatController.js";
import { none } from "../validators/me.js";
import { chatBody } from "../validators/chat.js";

export const chatRoutes = Router();

const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
const chatLimit = userRateLimit({ windowMs: 10 * 60_000, limit: 20 });

chatRoutes.post(
  "/",
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requirePermission("profile:read_own"),
  chatLimit,
  validate({ body: chatBody, query: none }),
  chat,
);
