import common from "./en.json";

// Strings are split by area so features can own their own file: en.json holds shared keys
// (app.*, common.*, errors.*), and src/i18n/en/<area>.json holds each area's keys.
// import.meta.glob is a Vite feature: it bundles every matching file at build time.
const areaFiles = import.meta.glob("./en/*.json", { eager: true, import: "default" });

// One flat dictionary. Hindi later: build the same object from hi.json + hi/*.json.
export const dictionary = Object.assign({}, common, ...Object.values(areaFiles));

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
