// Pincode community (decision 7) and its moderation. Reads need sign-in; writes a verified email;
// moderation post:moderate, with the city scope applied in the service's query.
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
import * as c from "../controllers/communityController.js";
import { none } from "../validators/me.js";
import * as v from "../validators/community.js";

export const communityRoutes = Router();
export const moderationRoutes = Router();

const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};
const read = [
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requirePermission("profile:read_own"),
];
const write = [
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("post:create"),
];
const mod = [
  noStore,
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("post:moderate"),
];

// Decision 7 / DESIGN.md 6: a resident writes a few posts a day; comments and flags are cheaper.
const postLimit = userRateLimit({ windowMs: 24 * 60 * 60_000, limit: 5 });
const commentLimit = userRateLimit({ windowMs: 60 * 60_000, limit: 30 });
const flagLimit = userRateLimit({ windowMs: 60 * 60_000, limit: 30 });

const route = communityRoutes;
route.get("/posts", ...read, validate({ query: v.feedQuery }), c.feed);
route.post(
  "/posts",
  ...write,
  postLimit,
  validate({ body: v.createPostBody, query: none }),
  c.newPost,
);
route.get("/posts/:id", ...read, validate({ params: v.idParams, query: none }), c.post);
route.delete("/posts/:id", ...write, validate({ params: v.idParams, query: none }), c.removePost);
route.get(
  "/posts/:id/comments",
  ...read,
  validate({ params: v.idParams, query: v.pageQuery }),
  c.comments,
);
route.post(
  "/posts/:id/comments",
  ...write,
  commentLimit,
  validate({ params: v.idParams, body: v.createCommentBody, query: none }),
  c.newComment,
);
route.delete(
  "/comments/:id",
  ...write,
  validate({ params: v.idParams, query: none }),
  c.removeComment,
);
route.post("/flags", ...write, flagLimit, validate({ body: v.flagBody, query: none }), c.flag);

moderationRoutes.get("/queue", ...mod, validate({ query: v.queueQuery }), c.queue);
moderationRoutes.post(
  "/:type/:id",
  ...mod,
  validate({ params: v.moderateParams, body: v.moderateBody, query: none }),
  c.act,
);
