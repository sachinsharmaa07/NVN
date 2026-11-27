import { describe, it, expect } from "vitest";
import {
  AUTO_HIDE_FLAGS,
  checkContentTransition,
  needsReason,
} from "../../src/utils/postStateMachine.js";

describe("checkContentTransition", () => {
  it.each([
    ["published", "hidden", "moderator", "ok"],
    ["published", "hidden", "system", "ok"],
    ["published", "hidden", "author", "forbidden"],
    ["published", "deleted", "author", "ok"],
    ["published", "deleted", "moderator", "ok"],
    ["published", "deleted", "system", "forbidden"],
    ["hidden", "published", "moderator", "ok"],
    ["hidden", "published", "author", "forbidden"],
    ["hidden", "published", "system", "forbidden"],
    ["hidden", "deleted", "author", "ok"],
    ["hidden", "deleted", "moderator", "ok"],
    ["deleted", "published", "moderator", "invalid"],
    ["deleted", "hidden", "moderator", "invalid"],
    ["published", "published", "moderator", "invalid"],
    ["hidden", "hidden", "system", "invalid"],
    ["unknown", "hidden", "moderator", "invalid"],
    ["published", "toString", "moderator", "invalid"],
  ])("%s -> %s by %s is %s", (from, to, actor, expected) => {
    expect(checkContentTransition(from, to, actor)).toBe(expected);
  });

  it("asks a moderator for a reason to hide or delete, never to restore", () => {
    expect(needsReason("hidden", "moderator")).toBe(true);
    expect(needsReason("deleted", "moderator")).toBe(true);
    expect(needsReason("published", "moderator")).toBe(false);
    expect(needsReason("deleted", "author")).toBe(false);
    expect(needsReason("hidden", "system")).toBe(false);
  });

  it("hides at three flags (decision 7)", () => {
    expect(AUTO_HIDE_FLAGS).toBe(3);
  });
});
