// POST /api/uploads/sign (decision 4): signs a direct browser-to-Cloudinary upload with node:crypto,
// so the photo never passes through our server and the API secret never leaves it.
// Cloudinary signature: SHA-1 of the sorted "key=value&..." of the signed params, then the secret.
import { createHash } from "node:crypto";
import { config } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { clock } from "../utils/clock.js";

export const UPLOAD_RULES = Object.freeze({
  maxBytes: 5 * 1024 * 1024,
  allowedFormats: ["jpg", "png", "webp", "heic"],
});
// An incoming transformation re-encodes the stored original, which drops EXIF (GPS, camera) metadata.
const INCOMING = "c_limit,w_1600,h_1600";

/** Where report photos live; the photo check refuses anything outside it. */
export const reportsFolder = () => `nivaran/${config.NODE_ENV}/reports`;

/** Signed into every upload, so discarding a photo can check who uploaded it (the browser can't change it). */
export const uploaderTag = (userId) => `u_${userId}`;

/** Pure: the Cloudinary signature for `params` (values already strings or numbers). */
export function cloudinarySignature(params, secret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + secret)
    .digest("hex");
}

/** Everything the browser needs for one signed upload. Valid for about an hour (Cloudinary's rule). */
export function signUpload(actor) {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey } = config;
  if (!cloudName || !config.CLOUDINARY_API_SECRET) {
    throw new AppError("UPLOADS_NOT_CONFIGURED", 503, "Photo uploads are not available right now.");
  }
  const params = {
    allowed_formats: UPLOAD_RULES.allowedFormats.join(","),
    folder: reportsFolder(),
    tags: uploaderTag(actor.id),
    timestamp: Math.floor(clock.now().getTime() / 1000),
    transformation: INCOMING,
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    apiKey,
    ...params,
    signature: cloudinarySignature(params, config.CLOUDINARY_API_SECRET),
    // A signed upload cannot cap file size: the client pre-checks maxBytes, and photoCheckService enforces it.
    maxBytes: UPLOAD_RULES.maxBytes,
  };
}
