// A return path may only point inside this site. Anything else becomes "/".
// "/report?x=1" is fine. "//evil.com", "/\evil.com" (browsers read \ as /), "https://evil.com"
// and "javascript:..." are not: they could send someone to another site after they sign in.
export function safePath(path) {
  return typeof path === "string" && /^\/(?![/\\])/.test(path) ? path : "/";
}
