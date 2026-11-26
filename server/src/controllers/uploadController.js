import { signUpload } from "../services/uploadService.js";

export async function sign(req, res) {
  res.json(signUpload());
}
