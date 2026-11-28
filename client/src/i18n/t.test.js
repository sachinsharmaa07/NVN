import { describe, expect, it, vi } from "vitest";
import { dictionaries, dictionary as en, getLanguage, setLanguage, t } from "./t";

describe("t()", () => {
  it("returns the English string for a known key", () => {
    expect(t("app.name")).toBe("Nivaran");
  });

  it("fills {placeholders} from vars and leaves unknown ones untouched", () => {
    // Add a temporary interpolated string for this test.
    en["test.greeting"] = "Pincode {pincode} is served in {city}. {missing}";
    expect(t("test.greeting", { pincode: "144401", city: "Phagwara" })).toBe(
      "Pincode 144401 is served in Phagwara. {missing}",
    );
    delete en["test.greeting"];
  });

  it("returns the key itself when it is missing, so gaps are visible", () => {
    expect(t("does.not.exist")).toBe("does.not.exist");
  });

  it("uses the requested language and falls back to English for a missing key", () => {
    const saved = dictionaries.hi["app.name"];
    expect(t("app.name", undefined, "hi")).toBe("निवारण");
    delete dictionaries.hi["app.name"];
    expect(t("app.name", undefined, "hi")).toBe("Nivaran");
    dictionaries.hi["app.name"] = saved;
    expect(t("app.name", undefined, "xx")).toBe("Nivaran");
  });

  it("has no key defined in two files (a later file would silently win)", () => {
    const files = Object.values(
      import.meta.glob(["./en.json", "./en/*.json"], { eager: true, import: "default" }),
    );
    const total = files.reduce((n, f) => n + Object.keys(f).length, 0);
    expect(Object.keys(en)).toHaveLength(total);
  });

  it("uses dotted camelCase keys (area.screen.key) only", () => {
    for (const key of Object.keys(en)) {
      expect(key).toMatch(/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z0-9]*){1,}$/);
    }
  });

  it("Hindi has only English keys, with the same {placeholders}", () => {
    const names = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    expect(Object.keys(dictionaries.hi).length).toBeGreaterThan(500);
    for (const [key, text] of Object.entries(dictionaries.hi)) {
      expect(Object.hasOwn(en, key), key).toBe(true);
      expect(names(text), key).toEqual(names(en[key]));
    }
  });

  it("loads Hindi lazily once; until then setLanguage('hi') means English", async () => {
    // A fresh copy of the module, as the app starts: English only (setup.js loaded Hindi into the shared one).
    vi.resetModules();
    const fresh = await import("./t");
    expect(fresh.isLanguageLoaded("hi")).toBe(false);
    fresh.setLanguage("hi");
    expect(fresh.getLanguage()).toBe("en");
    expect(fresh.t("app.name", undefined, "hi")).toBe("Nivaran");
    const heard = vi.fn();
    const stop = fresh.onLanguageLoaded(heard);
    await Promise.all([fresh.loadLanguage("hi"), fresh.loadLanguage("hi")]);
    stop();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(fresh.isLanguageLoaded("hi")).toBe(true);
    fresh.setLanguage("hi");
    expect(fresh.t("app.name")).toBe("निवारण");
    await expect(fresh.loadLanguage("en")).resolves.toBeUndefined();
  });

  it("uses the language set by setLanguage, and English for an unknown one", () => {
    setLanguage("hi");
    expect(getLanguage()).toBe("hi");
    expect(t("app.name")).toBe("निवारण");
    setLanguage("xx");
    expect(t("app.name")).toBe("Nivaran");
    setLanguage("en");
  });
});
