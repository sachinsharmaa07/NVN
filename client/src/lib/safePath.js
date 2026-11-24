// A return path may only point inside this site. Anything else becomes "/".
// "/report?x=1" is fine. "//evil.com", "/\\evil.com" (browsers read \ as /), "https://evil.com"
// and "javascript:..." are not: they could send someone to another site after they sign in.
// Control characters (tab, newline, anything below 0x20, and 0x7f) are refused too: browsers
// silently delete them from URLs, so "/\t/evil.com" would turn into "//evil.com".
export function safePath(path) {
  if (typeof path !== "string" || !/^\/(?![/\\])/.test(path)) return "/";
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return "/"; // 0x5c is the backslash
  }
  return path;
}
