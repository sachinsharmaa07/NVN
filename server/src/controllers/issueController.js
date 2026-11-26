import { createIssue, getOwnIssue } from "../services/issueService.js";
import { AppError } from "../utils/AppError.js";
import { idempotencyKey } from "../validators/issues.js";

export async function create(req, res) {
  const key = idempotencyKey.safeParse(req.get("Idempotency-Key"));
  if (!key.success) {
    throw new AppError(
      "INVALID_IDEMPOTENCY_KEY",
      400,
      "Send an Idempotency-Key header holding a UUID.",
    );
  }
  const { created, issue } = await createIssue(req.user, req.valid.body, key.data, {
    ip: req.ip,
    requestId: req.id,
  });
  // 201 for a new issue; 200 when the same key comes back (a retry or a double tap).
  res.status(created ? 201 : 200).json(issue);
}

export async function getOne(req, res) {
  res.json(await getOwnIssue(req.user, req.valid.params.ticketId));
}
