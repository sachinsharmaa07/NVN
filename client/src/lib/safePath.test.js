import { describe, expect, it } from "vitest";
import { safePath } from "./safePath";

describe("safePath", () => {
  it.each(["/", "/report", "/report?pincode=144401", "/issues#top"])("keeps %s", (path) => {
    expect(safePath(path)).toBe(path);
  });

  it.each([
    "//evil.com/x",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "report",
    "",
    undefined,
    null,
    42,
  ])("replaces %s with /", (path) => {
    expect(safePath(path)).toBe("/");
  });
});
