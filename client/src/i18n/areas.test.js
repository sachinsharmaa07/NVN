import { describe, expect, it } from "vitest";
import pageAreas from "./enDeferred";
import { dictionary, loadPageStrings, t } from "./t";

// Every English area file, read straight from disk (eager glob), to compare with what t() resolves.
const areaFiles = import.meta.glob("./en/*.json", { eager: true, import: "default" });
const areaName = (path) => path.match(/\/(\w+)\.json$/)[1];
const PAGE_ONLY = [
  "admin",
  "citySettings",
  "community",
  "issues",
  "moderation",
  "profile",
  "report",
  "staff",
];

describe("English strings split by area (HLD §7)", () => {
  it("page-only areas are exactly the ones in enDeferred.js", () => {
    const deferred = Object.entries(areaFiles)
      .filter(([, strings]) => Object.keys(strings).every((key) => key in pageAreas))
      .map(([path]) => areaName(path))
      .sort();
    expect(deferred).toEqual(PAGE_ONLY);
  });

  // One test per area: no key of it ever shows raw once a page has loaded its strings.
  for (const [path, strings] of Object.entries(areaFiles)) {
    it(`${areaName(path)}: every key resolves`, async () => {
      await loadPageStrings();
      const raw = Object.keys(strings).filter((key) => t(key, undefined, "en") === key);
      expect(raw).toEqual([]);
    });
  }

  it("the shell's areas are in the first download, without any page strings", () => {
    const shellAreas = Object.entries(areaFiles).filter(
      ([path]) => !PAGE_ONLY.includes(areaName(path)),
    );
    for (const [, strings] of shellAreas) {
      for (const key of Object.keys(strings)) expect(key in pageAreas).toBe(false);
    }
    // Sanity: the shared dictionary object is the one t() reads.
    expect(dictionary["shell.chat.open"]).toBeTypeOf("string");
  });
});
