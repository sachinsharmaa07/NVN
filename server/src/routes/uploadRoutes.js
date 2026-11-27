// Signed Cloudinary uploads for report photos. Signed-in, verified residents only: each signature costs storage.
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
import { discard, sign } from "../controllers/uploadController.js";
import { none } from "../validators/me.js";
import { discardBody } from "../validators/uploads.js";

export const uploadRoutes = Router();

// 3 photos per report (decision 4) and some retries: 20 signatures per 10 minutes per user.
const signLimit = userRateLimit({ windowMs: 10 * 60_000, limit: 20 });
// Its own budget: discarding a draft must not use up the signatures for the next one.
const discardLimit = userRateLimit({ windowMs: 10 * 60_000, limit: 20 });

const who = [
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  authenticate,
  loadUser,
  requireActive,
  requireVerifiedEmail,
  requirePermission("issue:create"),
];

uploadRoutes.post("/sign", ...who, signLimit, validate({ body: none, query: none }), sign);
// POST, not DELETE with a body: some proxies and clients drop a DELETE body.
uploadRoutes.post(
  "/discard",
  ...who,
  discardLimit,
  validate({ body: discardBody, query: none }),
  discard,
);
