import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n/t";
import { plural } from "./plural";

// Temporary strings for this test only, like t.test.js does.
const KEYS = {
  en: {
    "test.reports.one": "{count} report in {city}",
    "test.reports.other": "{count} reports in {city}",
  },
  hi: {
    "test.reports.one": "{city} में {count} रिपोर्ट",
    "test.reports.other": "{city} में {count} रिपोर्टें",
  },
};

describe("plural()", () => {
  beforeEach(() => {
    for (const lang of ["en", "hi"]) Object.assign(dictionaries[lang], KEYS[lang]);
  });
  afterEach(() => {
    for (const lang of ["en", "hi"])
      for (const key of Object.keys(KEYS[lang])) delete dictionaries[lang][key];
  });

  it("uses English plural rules", () => {
    expect(plural(1, "test.reports", { city: "Phagwara" }, "en")).toBe("1 report in Phagwara");
    expect(plural(2, "test.reports", { city: "Phagwara" }, "en")).toBe("2 reports in Phagwara");
  });

  it("uses Hindi plural rules", () => {
    expect(plural(1, "test.reports", { city: "फगवाड़ा" }, "hi")).toBe("फगवाड़ा में 1 रिपोर्ट");
    expect(plural(2, "test.reports", { city: "फगवाड़ा" }, "hi")).toBe("फगवाड़ा में 2 रिपोर्टें");
  });
});
