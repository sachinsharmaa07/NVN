import { discardPhotos } from "../services/photoCheckService.js";
import { signUpload } from "../services/uploadService.js";

export async function sign(req, res) {
  res.json(signUpload());
}

export async function discard(req, res) {
  await discardPhotos(req.valid.body.publicIds);
  res.status(204).end();
}
