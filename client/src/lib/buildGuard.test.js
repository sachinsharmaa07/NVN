import { describe, expect, it } from "vitest";
import { assertNoE2EBuild } from "./buildGuard";

describe("assertNoE2EBuild", () => {
  it("stops a production build when VITE_E2E is set", () => {
    expect(() => assertNoE2EBuild("build", { VITE_E2E: "1" })).toThrow(/VITE_E2E is set/);
    expect(() => assertNoE2EBuild("build", { VITE_E2E: "true" })).toThrow();
  });

  it("allows a build without the flag, and the dev server with it", () => {
    expect(() => assertNoE2EBuild("build", {})).not.toThrow();
    expect(() => assertNoE2EBuild("build", { VITE_E2E: "" })).not.toThrow();
    expect(() => assertNoE2EBuild("serve", { VITE_E2E: "1" })).not.toThrow();
  });
});
