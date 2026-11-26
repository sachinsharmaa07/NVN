// Report photos: shrink in the browser, then upload straight to Cloudinary with the server's signature
// (decision 4). The server never sees the file; POST /api/issues re-checks what Cloudinary stored.

export const MAX_PHOTOS = 3;
export const MAX_BYTES = 5 * 1024 * 1024; // same rule as the server's UPLOAD_RULES.maxBytes
export const ACCEPT = "image/jpeg,image/png,image/webp,image/heic";
const MAX_SIDE = 1600;

/**
 * Re-draws the photo at most 1600 px on its longer side as a JPEG. Re-drawing also drops EXIF (GPS).
 * A format the browser can't decode (HEIC outside Safari) is returned as it is; Cloudinary converts it.
 */
export async function compressImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file); // applies the EXIF rotation, so the photo stays upright
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

/**
 * POSTs `blob` to Cloudinary with the signed params from POST /api/uploads/sign. XMLHttpRequest, not
 * fetch: only XHR reports upload progress. Resolves Cloudinary's answer ({ public_id, ... }).
 */
export function uploadToCloudinary(blob, signed, onProgress) {
  const { uploadUrl, apiKey, signature, maxBytes: _maxBytes, ...params } = signed;
  const form = new FormData();
  form.append("file", blob);
  form.append("api_key", apiKey);
  form.append("signature", signature);
  for (const [key, value] of Object.entries(params)) form.append(key, String(value));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // not JSON: treated as a failed upload below
      }
      if (xhr.status === 200 && body?.public_id) resolve(body);
      else reject(new Error(`upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(form);
  });
}
