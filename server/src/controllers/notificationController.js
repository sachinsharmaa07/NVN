import { listMine, markRead } from "../services/notificationService.js";

export async function list(req, res) {
  res.json(await listMine(req.user, req.valid.query));
}

export async function read(req, res) {
  res.json(await markRead(req.user, req.valid.body));
}
