import { getStats } from "../services/statsService.js";

export async function stats(req, res) {
  res.set("Cache-Control", "public, max-age=300");
  res.json(await getStats());
}
