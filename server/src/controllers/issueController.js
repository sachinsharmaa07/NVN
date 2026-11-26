import { createIssue, getOwnIssue } from "../services/issueService.js";
import { listMine } from "../services/issueQueryService.js";
import { assignIssue, changeStatus, reporterAction } from "../services/issueWorkflowService.js";
import { setHold } from "../services/issueHoldService.js";
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

export async function mine(req, res) {
  res.json(await listMine(req.user, req.valid.query));
}

const ctx = (req) => ({ ip: req.ip, requestId: req.id });
const ticket = (req) => req.valid.params.ticketId;

export async function status(req, res) {
  res.json(await changeStatus(req.user, ticket(req), req.valid.body, ctx(req)));
}
export async function assign(req, res) {
  res.json(await assignIssue(req.user, ticket(req), req.valid.body, ctx(req)));
}
export async function confirm(req, res) {
  res.json(await reporterAction(req.user, ticket(req), "closed", req.valid.body, ctx(req)));
}
export async function reopen(req, res) {
  res.json(await reporterAction(req.user, ticket(req), "reopened", req.valid.body, ctx(req)));
}
export async function hold(req, res) {
  res.json(await setHold(req.user, ticket(req), true, req.valid.body, ctx(req)));
}
export async function resume(req, res) {
  res.json(await setHold(req.user, ticket(req), false, req.valid.body, ctx(req)));
}
