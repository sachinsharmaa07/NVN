import { beforeEach, describe, expect, it } from "vitest";
import { claimMfaAttempt, clearMfaAttempt, mfaAttempted, MFA_WINDOW_MS } from "./mfaGuard";

beforeEach(() => window.sessionStorage.clear());

describe("mfaGuard", () => {
  it("allows one attempt, then refuses until the window has passed", () => {
    const t0 = 1_000_000;
    expect(claimMfaAttempt(t0)).toBe(true);
    expect(claimMfaAttempt(t0 + 1000)).toBe(false);
    expect(mfaAttempted(t0 + MFA_WINDOW_MS - 1)).toBe(true);
    expect(claimMfaAttempt(t0 + MFA_WINDOW_MS + 1)).toBe(true);
  });

  it("clearing keeps a fresh attempt but removes an old one", () => {
    const t0 = 1_000_000;
    claimMfaAttempt(t0);
    clearMfaAttempt(t0 + 1000);
    expect(mfaAttempted(t0 + 1000)).toBe(true);
    clearMfaAttempt(t0 + MFA_WINDOW_MS + 1);
    expect(window.sessionStorage.getItem("nivaran.mfaAttemptAt")).toBeNull();
  });

  it("when storage is blocked it refuses to redirect (fail safe)", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    expect(claimMfaAttempt()).toBe(false);
    Storage.prototype.setItem = original;
  });
});
