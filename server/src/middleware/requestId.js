// Gives every request an id (req.id + X-Request-Id response header) so all its log lines can be joined.
import { randomUUID } from "node:crypto";

// Accept a caller's id only if it is short and plain, so it cannot inject junk into logs or headers.
const SAFE_ID = /^[\w-]{1,64}$/;

export function requestId(req, res, next) {
  const incoming = req.get("X-Request-Id");
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.set("X-Request-Id", req.id);
  next();
}
