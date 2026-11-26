import { checkPoint as check, lookupPincode } from "../services/pincodeService.js";

export async function checkPoint(req, res) {
  res.json(await check(req.valid.params.pin, req.valid.body));
}

export async function lookup(req, res) {
  const pincode = await lookupPincode(req.valid.params.pin);
  // Directory data changes only on a re-import; a day of caching spares the API on every keystroke retry.
  res.set("Cache-Control", "public, max-age=86400");
  res.json(pincode);
}
