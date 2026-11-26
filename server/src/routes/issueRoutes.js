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
import {
  assign,
  confirm,
  create,
  getOne,
  hold,
  mine,
  reopen,
  resume,
  status,
} from "../controllers/issueController.js";
import { none } from "../validators/me.js";
import {
  assignBody,
  createIssueBody,
  holdBody,
  mineQuery,
  reopenBody,
  statusBody,
  ticketParams,
  versionBody,
} from "../validators/issues.js";

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

// M2 writes. Scope (department, city, or reporter) is checked inside the service's query.
const write = (method, path, permission, body, handler) =>
  issueRoutes[method](
    path,
    noStore,
    authenticate,
    loadUser,
    requireActive,
    requireVerifiedEmail,
    requirePermission(permission),
    validate({ params: ticketParams, body, query: none }),
    handler,
  );

write("patch", "/:ticketId/status", "issue:update_status", statusBody, status);
write("patch", "/:ticketId/assign", "issue:assign", assignBody, assign);
// The reporter's own issue: any role that can read its own issues, matched on reporterId in the service.
write("post", "/:ticketId/confirm", "issue:read_own", versionBody, confirm);
write("post", "/:ticketId/reopen", "issue:read_own", reopenBody, reopen);
// dept_head only (the service refuses other roles).
write("post", "/:ticketId/hold", "issue:update_status", holdBody, hold);
write("post", "/:ticketId/resume", "issue:update_status", versionBody, resume);
