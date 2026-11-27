import { listAudit } from "../services/auditService.js";

export async function audit(req, res) {
  res.json(await listAudit(req.user, req.valid.query));
}
