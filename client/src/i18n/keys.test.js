import { describe, expect, it } from "vitest";
import enShared from "./en.json";
import hiShared from "./hi.json";

// LLD §1: every English key exists in Hindi too (and nothing extra), area by area, so no screen ever
// falls back to English mid-page. The shared files (en.json, hi.json) are compared as well.

const en = import.meta.glob("./en/*.json", { eager: true, import: "default" });
const hi = import.meta.glob("./hi/*.json", { eager: true, import: "default" });
const area = (path) => path.match(/\/(\w+)\.json$/)[1];

// Nested objects become dotted keys, so either shape compares the same way.
function flatKeys(object, prefix = "") {
  return Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === "object" ? flatKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("en and hi have the same keys", () => {
  it("the same area files exist in both languages", () => {
    expect(Object.keys(hi).map(area).sort()).toEqual(Object.keys(en).map(area).sort());
  });

  it("shared (en.json, hi.json)", () => {
    expect(flatKeys(hiShared).sort()).toEqual(flatKeys(enShared).sort());
  });

  for (const [path, strings] of Object.entries(en)) {
    it(`${area(path)}`, () => {
      const hiStrings = hi[path.replace("./en/", "./hi/")] ?? {};
      expect(flatKeys(hiStrings).sort()).toEqual(flatKeys(strings).sort());
    });
  }
});
