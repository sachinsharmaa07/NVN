// The one error type services and middleware throw on purpose.
// errorHandler turns it into { error: { code, message, details? } } with the given HTTP status.
export class AppError extends Error {
  /**
   * @param {string} code    stable UPPER_SNAKE code the client can branch on, e.g. "OUTSIDE_PINCODE"
   * @param {number} status  HTTP status, e.g. 422
   * @param {string} message human-readable text (safe to show the user)
   * @param {unknown} [details] optional structured extra info
   */
  constructor(code, status, message, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}
