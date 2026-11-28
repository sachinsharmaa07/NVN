// HLD §7: ask Cloudinary for a photo near its rendered size, in the browser's best format.
// Delivery URL: https://res.cloudinary.com/<cloud>/image/upload/<transformations>/<version>/<public_id>
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
// A transformation component starts with a short parameter key, e.g. "w_200" or "c_limit,w_400".
// shortcut: an unversioned public id like "my_photo" also matches and is left unsized; harmless, upgrade if it shows up.
const TRANSFORMATION = /^[a-z]{1,3}_/;

/**
 * Cloudinary URL -> the same image scaled down to at most `width` px (never up), auto format and quality.
 * f_auto and q_auto are separate components (Cloudinary's chaining rules). Any other URL, or one that
 * already carries a transformation, comes back unchanged.
 */
export function sizedImage(url, width) {
  const match = typeof url === "string" ? url.match(CLOUDINARY_UPLOAD) : null;
  if (!match || TRANSFORMATION.test(match[2])) return url;
  return `${match[1]}c_limit,w_${width}/f_auto/q_auto/${match[2]}`;
}
