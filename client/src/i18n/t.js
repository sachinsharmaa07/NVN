import en from "./en.json";

// Hindi later: add hi.json with the same keys and pick the dictionary by the active language.
const dictionary = en;

/**
 * Looks up a UI string by key and fills in {placeholders}.
 * t("report.pincode.notServed", { pincode: "144401" })
 * A missing key returns the key itself, so gaps are visible on screen instead of blank.
 */
export function t(key, vars) {
  const template = dictionary[key];
  if (typeof template !== "string") return key;
  if (!vars) return template;
  // Replace each {name} with vars.name; unknown placeholders are left as they are.
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
