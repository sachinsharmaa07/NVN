import { rateLimit } from "express-rate-limit";
import { AppError } from "../utils/AppError.js";

/** A stricter limit counted per signed-in user (req.user.id), for routes that cost money or send email. */
export function userRateLimit({ windowMs, limit }) {
  return rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next) =>
      next(new AppError("RATE_LIMITED", 429, "Too many tries. Please wait a while and try again.")),
  });
}
