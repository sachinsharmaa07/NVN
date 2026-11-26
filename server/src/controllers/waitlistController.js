import { joinWaitlist } from "../services/waitlistService.js";

export async function join(req, res) {
  res.json(await joinWaitlist(req.valid.body));
}
