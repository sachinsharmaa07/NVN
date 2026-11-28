// Photo check for POST /api/issues (decision M1-12): a signed Cloudinary upload cannot cap size, so before an
// issue may reference a photo we ask the Cloudinary Admin API (fetch + basic auth, no SDK) what was stored.
// Our folder, <= 5 MB, an allowed format; anything else is deleted and refused. discardPhotos deletes a draft's
// photos the citizen abandoned (POST /api/uploads/discard), never one an issue uses.
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Issue } from "../models/Issue.js";
import { AppError } from "../utils/AppError.js";
import { notFound, trusted } from "./adminUserSupport.js";
import { UPLOAD_RULES, reportsFolder, uploaderTag } from "./uploadService.js";

export const CHECK_TIMEOUT_MS = 5000;
const log = logger.child({ component: "photoCheck" });

const invalid = (index) =>
  new AppError(
    "INVALID_PHOTO",
    400,
    "One of the photos can't be used. Remove it and add it again.",
    {
      index,
    },
  );
const unavailable = () =>
  new AppError(
    "UPSTREAM_UNAVAILABLE",
    503,
    "We couldn't check your photos right now. Try again in a minute.",
  );

const defaultFetch = (...a) => globalThis.fetch(...a);

/** The Admin API (basic auth, 5 s timeout, unreachable -> 503) after the shape check every id must pass. */
function cloudinaryAdmin(publicIds, fetchImpl) {
  const {
    CLOUDINARY_CLOUD_NAME: cloud,
    CLOUDINARY_API_KEY: key,
    CLOUDINARY_API_SECRET: secret,
  } = config;
  if (!cloud || !secret) {
    throw new AppError("UPLOADS_NOT_CONFIGURED", 503, "Photo uploads are not available right now.");
  }
  const folder = reportsFolder();
  // Shape check before the id goes into a URL: our folder, one plain name segment, nothing else.
  const idPattern = new RegExp(`^${folder}/[\\w-]{1,100}$`);
  const bad = publicIds.findIndex((id) => !idPattern.test(id));
  if (bad !== -1) throw invalid(bad);

  const base = `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload`;
  const headers = { authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` };
  const call = async (url, method) => {
    try {
      return await fetchImpl(url, {
        method,
        headers,
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      });
    } catch (err) {
      log.warn({ method, kind: err?.name }, "cloudinary unreachable");
      throw unavailable();
    }
  };
  return { base, call, folder };
}

/** 401/403 means our keys are wrong: an operator problem, not the user's. */
const refused = (status) =>
  log[status === 401 || status === 403 ? "error" : "warn"](
    { status },
    "cloudinary admin api refused",
  );

/**
 * Verifies each public_id (max 3, already Zod-checked as strings) and returns what the Issue stores.
 * @returns {Promise<{ publicId: string, width: number, height: number }[]>}
 */
export async function verifyPhotos(publicIds, { fetchImpl = defaultFetch } = {}) {
  const { base, call, folder } = cloudinaryAdmin(publicIds, fetchImpl);

  const check = async (publicId, index) => {
    const res = await call(`${base}/${publicId}`, "GET");
    if (res.status === 404) throw invalid(index);
    if (!res.ok) {
      refused(res.status);
      throw unavailable();
    }
    const asset = await res.json().catch(() => null);
    if (!asset) throw unavailable();
    const ok =
      asset.bytes <= UPLOAD_RULES.maxBytes &&
      UPLOAD_RULES.allowedFormats.includes(asset.format) &&
      (asset.asset_folder === undefined || asset.asset_folder === folder);
    if (ok) return { publicId, width: asset.width, height: asset.height };

    // Ours but unusable: delete it so oversized files don't pile up, then refuse. A failed delete still refuses.
    log.info({ publicId, bytes: asset.bytes, format: asset.format }, "photo refused, deleting");
    const del = await call(`${base}?public_ids[]=${encodeURIComponent(publicId)}`, "DELETE").catch(
      () => null,
    );
    if (!del?.ok) log.warn({ publicId, status: del?.status }, "refused photo not deleted");
    throw invalid(index);
  };

  // allSettled so every refused photo still gets its delete; the first failure (in order) decides the error.
  const results = await Promise.allSettled(publicIds.map(check));
  const failed = results.find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
  return results.map((r) => r.value);
}

/**
 * POST /api/uploads/discard: deletes the actor's own photos of an abandoned draft. Idempotent (a gone id is fine).
 * Deletes nothing when any id is on an issue (409) or was not uploaded by the actor (404, the same as missing):
 * every signed upload carries the uploader's tag, which the browser can't change.
 * Known limit: a discard racing a submit of the same ids can delete a photo the new issue then points at; only
 * the uploader can cause it, so it is accepted.
 */
export async function discardPhotos(actor, publicIds, { fetchImpl = defaultFetch } = {}) {
  const { base, call } = cloudinaryAdmin(publicIds, fetchImpl);
  const used = trusted({ $in: publicIds });
  if (
    await Issue.exists({ $or: [{ "photos.publicId": used }, { "afterPhotos.publicId": used }] })
  ) {
    throw new AppError("CONFLICT", 409, "A photo that's part of a report can't be removed.");
  }
  const owned = await Promise.all(
    publicIds.map(async (id) => {
      const res = await call(`${base}/${id}`, "GET");
      if (res.status === 404) return null; // already gone: nothing to do
      if (!res.ok) {
        refused(res.status);
        throw unavailable();
      }
      const asset = await res.json().catch(() => null);
      if (!asset) throw unavailable();
      // Untagged (uploaded before the tag) or someone else's: the same 404 as a missing resource.
      if (!asset.tags?.includes(uploaderTag(actor.id))) throw notFound();
      return id;
    }),
  );
  const toDelete = owned.filter(Boolean);
  if (!toDelete.length) return;
  const query = toDelete.map((id) => `public_ids[]=${encodeURIComponent(id)}`).join("&");
  const res = await call(`${base}?${query}`, "DELETE");
  if (!res.ok) {
    refused(res.status);
    throw unavailable();
  }
}
