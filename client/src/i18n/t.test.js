import { describe, expect, it } from "vitest";
import { dictionary as en, t } from "./t";

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

  it("has no key defined in two files (a later file would silently win)", () => {
    const files = Object.values(
      import.meta.glob("./**/*.json", { eager: true, import: "default" }),
    );
    const total = files.reduce((n, f) => n + Object.keys(f).length, 0);
    expect(Object.keys(en)).toHaveLength(total);
  });

  it("uses dotted camelCase keys (area.screen.key) only", () => {
    for (const key of Object.keys(en)) {
      expect(key).toMatch(/^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z0-9]*){1,}$/);
    }
  });
});
