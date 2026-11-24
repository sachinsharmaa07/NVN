import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { loadUser } from "../middleware/access.js";
import { userRateLimit } from "../middleware/userRateLimit.js";
import { getMe, resendVerification } from "../controllers/meController.js";

export const meRoutes = Router();

// Personal data: browsers and proxies must not keep a copy.
meRoutes.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const none = z.object({}).strict(); // these routes take no body, params or query

// Works for unverified users too: it is how a first-time user gets their record.
meRoutes.get("/", authenticate, validate({ query: none }), getMe);

meRoutes.post(
  "/resend-verification",
  authenticate,
  loadUser,
  userRateLimit({ windowMs: 60 * 60 * 1000, limit: 3 }), // 3 emails an hour per user
  validate({ body: none, query: none }),
  resendVerification,
);
