import { getCitySettings, updateCategory } from "../services/citySettingsService.js";

export async function settings(req, res) {
  res.json(await getCitySettings(req.user, req.valid.query));
}

export async function update(req, res) {
  const ctx = { ip: req.ip, requestId: req.id };
  res.json(await updateCategory(req.user, req.valid.params.category, req.valid.body, ctx));
}
