import { createCity, updateCity } from "../services/cityAdminService.js";

const ctx = (req) => ({ ip: req.ip, requestId: req.id });

export async function create(req, res) {
  res.status(201).json(await createCity(req.user, req.valid.body, ctx(req)));
}

export async function update(req, res) {
  res.json(await updateCity(req.user, req.valid.params.id, req.valid.body, ctx(req)));
}
