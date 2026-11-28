import { describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n/t";
import { AUDIT_ACTIONS, AUDIT_TARGETS, actionLabel, shortId, targetLabel } from "./auditText";

// The server's list, copied from AUDIT_ACTIONS in server/src/models/AuditLog.js (feat/backend-finish).
// If the server adds an action, add it here and in auditText.js with its label.
const SERVER_ACTIONS = [
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

describe("audit labels", () => {
  it("matches the server's action list", () => {
    expect(AUDIT_ACTIONS).toEqual(SERVER_ACTIONS);
    expect(AUDIT_TARGETS).toEqual(["user", "issue", "post", "comment", "city", "department"]);
  });

  it("has an English and a Hindi label for every action and target", () => {
    for (const action of SERVER_ACTIONS) expect(actionLabel(action), action).not.toBeNull();
    for (const type of AUDIT_TARGETS) expect(targetLabel(type)).not.toBe(type);
    const hiKeys = Object.keys(dictionaries.hi).filter((k) => k.startsWith("admin.audit.action."));
    expect(hiKeys).toHaveLength(SERVER_ACTIONS.length);
  });

  it("knows nothing about an action the server adds later, so the page shows its raw code", () => {
    expect(actionLabel("city.delete")).toBeNull();
  });

  it("shortens an id to its last 6 characters", () => {
    expect(shortId("6750e2e0e2e0e2e0e2e0e301")).toBe("e0e301");
  });
});
