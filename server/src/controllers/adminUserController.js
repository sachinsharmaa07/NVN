import * as adminUsers from "../services/adminUserService.js";

// Request context the audit trail needs. req.ip is the real client only when TRUST_PROXY is right.
const contextOf = (req) => ({ ip: req.ip, requestId: req.id, log: req.log });

export async function listUsers(req, res) {
  res.json(await adminUsers.listUsers(req.user, req.valid.query, contextOf(req)));
}

export async function changeRole(req, res) {
  const { params, body } = req.valid;
  res.json(await adminUsers.changeRole(req.user, params.id, body, contextOf(req)));
}

export async function setStatus(req, res) {
  const { params, body } = req.valid;
  res.json(await adminUsers.setStatus(req.user, params.id, body, contextOf(req)));
}
