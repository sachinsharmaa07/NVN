import { answer } from "../services/chatService.js";

export async function chat(req, res) {
  res.json(await answer(req.user, req.valid.body, req.log));
}
