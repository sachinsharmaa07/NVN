import { t } from "@/i18n/t";

/*
 * Human labels for the audit log. ACTIONS and TARGETS copy AUDIT_ACTIONS and AUDIT_TARGETS from
 * server/src/models/AuditLog.js (as on feat/backend-finish, which adds department.*); auditText.test.js
 * checks every one has a label. An action the server adds later still shows, as its raw code.
 */
export const AUDIT_ACTIONS = [
  "user.role_change",
  "user.suspend",
  "user.reactivate",
  "user.bootstrap_super_admin",
  "user.mfa_flag_sync_failed",
  "user.identity_linked",
  "issue.created",
  "issue.status_change",
  "issue.assign",
  "issue.hold",
  "issue.resume",
  "post.hide",
  "post.restore",
  "post.delete",
  "comment.hide",
  "comment.restore",
  "comment.delete",
  "city.category_update",
  "city.create",
  "city.update",
  "department.create",
  "department.update",
];
export const AUDIT_TARGETS = ["user", "issue", "post", "comment", "city", "department"];

// "user.role_change" -> the i18n key "admin.audit.action.userRoleChange" (keys are dotted camel case).
const actionKey = (action) =>
  `admin.audit.action.${action.replace(".", "_").replace(/_(\w)/g, (_, c) => c.toUpperCase())}`;

/** The label for an action code, or null for one this client doesn't know yet. */
export function actionLabel(action) {
  const key = actionKey(action);
  const label = t(key);
  return label === key ? null : label;
}

export const targetLabel = (type) => {
  const key = `admin.audit.target.${type}`;
  const label = t(key);
  return label === key ? type : label;
};

/** The last 6 characters of an id: enough to tell rows apart at a glance; Copy gives the whole id. */
export const shortId = (id) => String(id).slice(-6);
