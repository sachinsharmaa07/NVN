import { describe, it, expect } from "vitest";
import { parseCsvLine } from "../../src/utils/csv.js";

describe("parseCsvLine", () => {
  it("splits plain, quoted, escaped and empty fields", () => {
    expect(parseCsvLine('a,"b, c","say ""hi""",,e')).toEqual(["a", "b, c", 'say "hi"', "", "e"]);
  });
});
