import { checkPoint as check } from "../services/pincodeService.js";

export async function checkPoint(req, res) {
  res.json(await check(req.valid.params.pin, req.valid.body));
}
