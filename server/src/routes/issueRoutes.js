// Issues. M1: a resident submits one and reads their own (tracking UI is M2).
import { Router } from "express";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  loadUser,
  requireActive,
  requirePermission,
  requireVerifiedEmail,
} from "../middleware/access.js";
import { userRateLimit } from "../middleware/userRateLimit.js";
import { create, getOne, mine } from "../controllers/issueController.js";
import { none } from "../validators/me.js";
import { createIssueBody, mineQuery, ticketParams } from "../validators/issues.js";

export const issueRoutes = Router();

const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
// A real resident files a few issues a day; 10 an hour also covers retries (replays count too).
const createLimit = userRateLimit({ windowMs: 60 * 60_000, limit: 10 });

issueRoutes.post(
  "/",
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("issue:create"),
  createLimit,
  validate({ body: createIssueBody, query: none }),
  create,
);

// Before "/:ticketId", so "mine" is never read as a ticket id.
issueRoutes.get(
  "/mine",
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requirePermission("issue:read_own"),
  validate({ query: mineQuery }),
  mine,
);

issueRoutes.get(
  "/:ticketId",
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requirePermission("issue:read_own"),
  validate({ params: ticketParams, query: none }),
  getOne,
);
