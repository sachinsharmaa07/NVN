// English strings that only pages use (UI.md §5.2: keep them out of the first download). One chunk,
// loaded by loadPageStrings() alongside any page; the shell's areas stay in t.js. Keep this list and the
// exclusion list in t.js the same (import.meta.glob needs literal patterns).
const files = import.meta.glob(
  "./en/{issues,report,community,profile,admin,staff,moderation,citySettings}.json",
  { eager: true, import: "default" },
);

export default Object.assign({}, ...Object.values(files));
