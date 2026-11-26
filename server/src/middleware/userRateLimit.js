import { rateLimit } from "express-rate-limit";
import { AppError } from "../utils/AppError.js";

/** A stricter limit counted per signed-in user (req.user.id), for routes that cost money or send email. */
// skipFailedRequests: a request that ended in an error (e.g. 503 because Auth0 was down) is not counted.
export function userRateLimit({ windowMs, limit, skipFailedRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipFailedRequests,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next) =>
      next(new AppError("RATE_LIMITED", 429, "Too many tries. Please wait a while and try again.")),
  });
}

/** A per-IP limit for public routes (no req.user). Behind a proxy it relies on TRUST_PROXY being right. */
export function ipRateLimit({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next) =>
      next(
        new AppError("RATE_LIMITED", 429, "Too many tries. Please wait a minute and try again."),
      ),
  });
}

// Admin routes (docs/phase-1-auth.md section 7): reads 60 per minute, writes 10 per minute, per user.
// Not passOnStoreError, so a failing limiter blocks instead of letting writes through.
export const adminReadLimit = userRateLimit({ windowMs: 60_000, limit: 60 });
export const adminWriteLimit = userRateLimit({ windowMs: 60_000, limit: 10 });
