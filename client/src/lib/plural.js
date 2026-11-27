import { getLanguage, t } from "@/i18n/t";

/**
 * Picks `<keyBase>.one` or `<keyBase>.other` for a count, using the language's own plural rules
 * (Hindi treats 0 and 1 as "one"; English only 1). `{count}` is always available to the string.
 * plural(3, "issues.list.count") -> "3 issues"
 */
export function plural(count, keyBase, vars, lang = getLanguage()) {
  const form = new Intl.PluralRules(lang).select(count) === "one" ? "one" : "other";
  return t(`${keyBase}.${form}`, { count, ...vars }, lang);
}
