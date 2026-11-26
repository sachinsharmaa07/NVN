import common from "./en.json";

// Strings are split by area so features can own their own file: en.json holds shared keys
// (app.*, common.*, errors.*), and src/i18n/en/<area>.json holds each area's keys.
// import.meta.glob is a Vite feature: it bundles every matching file at build time.
const areaFiles = import.meta.glob("./en/*.json", { eager: true, import: "default" });

// One flat dictionary per language. Hindi files (hi.json, hi/*.json) are optional until they are written.
export const dictionary = Object.assign({}, common, ...Object.values(areaFiles));
const hiFiles = import.meta.glob(["./hi.json", "./hi/*.json"], { eager: true, import: "default" });
export const dictionaries = { en: dictionary, hi: Object.assign({}, ...Object.values(hiFiles)) };

/**
 * Looks up a UI string by key and fills in {placeholders}.
 * t("report.pincode.notServed", { pincode: "144401" })
 * A key missing in `lang` falls back to English; missing in English too, it returns the key
 * itself, so gaps are visible on screen instead of blank.
 */
export function t(key, vars, lang = "en") {
  const template = dictionaries[lang]?.[key] ?? dictionary[key];
  if (typeof template !== "string") return key;
  if (!vars) return template;
  // Replace each {name} with vars.name; unknown placeholders are left as they are.
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
