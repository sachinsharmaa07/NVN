import { listCities } from "../services/adminUserService.js";
import { createCity, updateCity } from "../services/cityAdminService.js";
import { waitlistDemand } from "../services/waitlistService.js";

const ctx = (req) => ({ ip: req.ip, requestId: req.id });

export async function create(req, res) {
  res.status(201).json(await createCity(req.user, req.valid.body, ctx(req)));
}

export async function update(req, res) {
  res.json(await updateCity(req.user, req.valid.params.id, req.valid.body, ctx(req)));
}

export async function list(req, res) {
  res.json(await listCities(req.user, req.valid.query));
}

export async function demand(req, res) {
  res.json(await waitlistDemand(req.valid.query));
}
