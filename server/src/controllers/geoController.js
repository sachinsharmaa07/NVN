import {
  listCities as cities,
  listDepartments as departments,
} from "../services/adminUserService.js";

export async function listCities(req, res) {
  res.json(await cities(req.user));
}

export async function listDepartments(req, res) {
  res.json(await departments(req.user, req.valid.query));
}
