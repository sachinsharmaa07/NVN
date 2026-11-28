import { discardPhotos } from "../services/photoCheckService.js";
import { signUpload } from "../services/uploadService.js";

export async function sign(req, res) {
  res.json(signUpload(req.user));
}

export async function discard(req, res) {
  await discardPhotos(req.user, req.valid.body.publicIds);
  res.status(204).end();
}
