// The last two middlewares. Every error response leaves the server through errorHandler,
// always shaped { error: { code, message, details?, requestId? } } and never with a stack trace.
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

/** Runs when no route matched. */
export function notFound(req, res, next) {
  next(new AppError("NOT_FOUND", 404, "The requested resource was not found."));
}

/** Maps a known error to { status, body }, or returns null for an unexpected one. */
function toKnownError(err) {
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { status: 400, code: "VALIDATION_ERROR", message: "Some fields are invalid.", details };
  }
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  // express.json() marks its own errors with a `type` (from the body-parser package).
  if (err?.type === "entity.parse.failed") {
    return { status: 400, code: "INVALID_JSON", message: "The request body is not valid JSON." };
  }
  if (err?.type === "entity.too.large") {
    return { status: 413, code: "PAYLOAD_TOO_LARGE", message: "The request body is too large." };
  }
  // Other body-parser client errors (unsupported charset or encoding, aborted upload) carry a
  // 4xx `status` and `expose: true`. They are the caller's fault, so they must not become a 500.
  if (err?.expose === true && err.status >= 400 && err.status < 500) {
    return { status: err.status, code: "BAD_REQUEST", message: "The request could not be read." };
  }
  return null;
}

// Express recognises an error handler by its 4 parameters.
export function errorHandler(err, req, res, next) {
  // If a response already started streaming, we can't send JSON now; Express's default handler
  // closes the connection instead.
  if (res.headersSent) return next(err);
  const known = toKnownError(err);

  if (known) {
    // Caller mistakes are not server errors: log at debug (4xx) so they don't page anyone.
    const level = known.status >= 500 ? "error" : "debug";
    req.log?.[level]({ event: "request.rejected", code: known.code }, known.message);
    const body = { code: known.code, message: known.message };
    if (known.details !== undefined) body.details = known.details;
    if (known.status >= 500) body.requestId = req.id;
    // Tell well-behaved clients how long to wait (AuthProviderError sets retryAfterSeconds).
    if (err?.retryAfterSeconds && !res.getHeader("Retry-After")) {
      res.set("Retry-After", String(err.retryAfterSeconds));
    }
    return res.status(known.status).json({ error: body });
  }

  // Unexpected: a bug or a failing dependency. Full error (with stack) goes to the logs only.
  req.log?.error({ event: "request.failed", err }, "Unhandled error");
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Please try again.",
      requestId: req.id, // quote this id to find the matching log line
    },
  });
}
