import common from "./en.json";

// Strings are split by area so features can own their own file: en.json holds shared keys
// (app.*, common.*, errors.*), and src/i18n/en/<area>.json holds each area's keys.
// import.meta.glob is a Vite feature: it bundles every matching file at build time.
const areaFiles = import.meta.glob("./en/*.json", { eager: true, import: "default" });

// One flat dictionary per language. English is in the main bundle; Hindi (i18n/hi.js) is its own chunk,
// loaded by loadLanguage("hi") when someone picks it, so English readers never download it (UI.md §5.2).
export const dictionary = Object.assign({}, common, ...Object.values(areaFiles));
export const dictionaries = { en: dictionary };
const loaders = { hi: () => import("./hi.js").then((m) => m.default) };
const pending = {};
const listeners = new Set();

export const isLanguageLoaded = (lang) => Object.hasOwn(dictionaries, lang);
/** Subscribe to "a dictionary finished loading" (for useSyncExternalStore). */
export const onLanguageLoaded = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
/** Fetches a language's dictionary once. Resolves at once for English or an unknown language. */
export function loadLanguage(lang) {
  if (isLanguageLoaded(lang) || !loaders[lang]) return Promise.resolve();
  pending[lang] ??= loaders[lang]().then(
    (dict) => {
      dictionaries[lang] = dict;
      listeners.forEach((fn) => fn());
    },
    (error) => {
      delete pending[lang]; // a later call may try again (e.g. after going back online)
      throw error;
    },
  );
  return pending[lang];
}

// The language every t() call uses unless it names one. AppLayout sets it from the signed-in user's
// preferredLanguage while rendering and remounts the page when it changes, so screens never mix languages.
// A language whose dictionary hasn't arrived yet counts as English, so t() stays synchronous.
let current = "en";
export const setLanguage = (lang) => {
  current = isLanguageLoaded(lang) ? lang : "en";
};
export const getLanguage = () => current;

/**
 * Looks up a UI string by key and fills in {placeholders}.
 * t("report.pincode.notServed", { pincode: "144401" })
 * A key missing in `lang` falls back to English; missing in English too, it returns the key
 * itself, so gaps are visible on screen instead of blank.
 */
export function t(key, vars, lang = current) {
  const template = dictionaries[lang]?.[key] ?? dictionary[key];
  if (typeof template !== "string") return key;
  if (!vars) return template;
  // Replace each {name} with vars.name; unknown placeholders are left as they are.
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
