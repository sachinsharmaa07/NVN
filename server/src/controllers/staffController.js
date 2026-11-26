import { listStaffQueue } from "../services/issueQueryService.js";

export async function queue(req, res) {
  res.json(await listStaffQueue(req.user, req.valid.query));
}
