import { createDepartment, updateDepartment } from "../services/departmentAdminService.js";

const ctx = (req) => ({ ip: req.ip, requestId: req.id });

export async function create(req, res) {
  res.status(201).json(await createDepartment(req.user, req.valid.body, ctx(req)));
}

export async function update(req, res) {
  res.json(await updateDepartment(req.user, req.valid.params.id, req.valid.body, ctx(req)));
}
