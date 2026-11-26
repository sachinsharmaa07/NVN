import {
  listAssignableDepartments,
  listCities as cities,
  listDepartments as departments,
} from "../services/adminUserService.js";
import { can } from "../utils/permissions.js";

export async function listCities(req, res) {
  res.json(await cities(req.user, req.valid.query));
}

export async function listDepartments(req, res) {
  // user:promote holders get the admin rules; the route let everyone else through only with issue:assign.
  const list = can(req.user.role, "user:promote") ? departments : listAssignableDepartments;
  res.json(await list(req.user, req.valid.query));
}
