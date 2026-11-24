// Builds the Express app without listening, so tests can drive it with Supertest.
// The middleware order matters: each request passes through these top to bottom.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { requestId } from "./middleware/requestId.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/AppError.js";
import { apiRoutes } from "./routes/index.js";

// No asyncHandler wrapper: Express 5 passes a rejected promise from an async handler
// to the error handler by itself, so `async (req, res) => { throw ... }` already works.

/** Picks a log level for the "request completed" line pino-http writes for each request. */
function accessLogLevel(req, res, err) {
  if (err || res.statusCode >= 500) return "error";
  if (res.statusCode >= 400) return "warn";
  if (req.originalUrl.startsWith("/api/health")) return "debug"; // monitors poll this often
  return "info";
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by"); // helmet also removes it; this keeps it off even if helmet changes
  // Number of proxies in front of us (TRUST_PROXY). With it, req.ip is the real user's IP, so the
  // rate limiter counts each user separately. 0 (local default) means "trust no X-Forwarded-For".
  app.set("trust proxy", config.TRUST_PROXY);

  // 1. Request id first, so every later step (and every log line) can use req.id.
  app.use(requestId);
  // 2. Access log + req.log child logger that carries the same id.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: accessLogLevel,
      // Keep access lines short: no full header dump.
      serializers: {
        // Path only: query strings can carry emails or tokens, which must not reach the logs.
        req: (req) => ({ id: req.id, method: req.method, path: req.url.split("?")[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  // 3. Security headers (CSP, HSTS, nosniff, ...).
  app.use(helmet());
  // 4. Only our own front end may call the API from a browser, with cookies allowed.
  app.use(cors({ origin: [config.CLIENT_URL], credentials: true }));
  // 5. Parse JSON bodies; larger than 100 kB is refused with 413.
  app.use(express.json({ limit: "100kb" }));
  // 6. Global rate limit per IP (in memory; fine for one server instance, see ADR 0001).
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 300, // requests per IP per window
      standardHeaders: "draft-8", // one combined `RateLimit` header
      legacyHeaders: false, // no X-RateLimit-* headers
      // Send our usual error shape instead of the library's plain-text message.
      handler: (req, res, next) =>
        next(
          new AppError(
            "RATE_LIMITED",
            429,
            "Too many requests. Please wait a few minutes and try again.",
          ),
        ),
    }),
  );

  // 7. Feature routes.
  app.use("/api", apiRoutes);

  // 8. Nothing matched: 404. 9. Format every error.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
