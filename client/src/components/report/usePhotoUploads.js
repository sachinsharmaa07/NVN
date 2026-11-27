import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { MAX_BYTES, MAX_PHOTOS, compressImage, uploadToCloudinary } from "@/lib/photoUpload";

/*
 * The photos of one report, in memory only (never in the session draft). Each photo:
 * { id, previewUrl, status: "preparing" | "uploading" | "done" | "error" | "too_large" | "refused",
 *   progress 0..1, publicId }. A failed upload keeps its shrunk blob so Retry doesn't redo the work.
 */
export function usePhotoUploads() {
  const api = useApi();
  const [photos, setPhotos] = useState([]);
  const blobs = useRef(new Map()); // id -> blob, kept out of state (not rendered)
  const urls = useRef(new Set());

  const update = useCallback(
    (id, patch) => setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  );

  const upload = useCallback(
    async (id) => {
      update(id, { status: "uploading", progress: 0 });
      try {
        // A fresh signature per photo: they expire after an hour, and a retry may come much later.
        const signed = await api("/api/uploads/sign", { method: "POST" });
        const stored = await uploadToCloudinary(blobs.current.get(id), signed, (progress) =>
          update(id, { progress }),
        );
        update(id, { status: "done", progress: 1, publicId: stored.public_id });
      } catch {
        update(id, { status: "error" });
      }
    },
    [api, update],
  );

  async function add(fileList) {
    const files = [...fileList].slice(0, MAX_PHOTOS - photos.length);
    for (const file of files) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      urls.current.add(previewUrl);
      setPhotos((ps) => [...ps, { id, previewUrl, status: "preparing", progress: 0 }]);
      const blob = await compressImage(file);
      if (blob.size > MAX_BYTES) {
        update(id, { status: "too_large" });
        continue;
      }
      blobs.current.set(id, blob);
      upload(id);
    }
  }

  function remove(id) {
    blobs.current.delete(id);
    setPhotos((ps) => ps.filter((p) => p.id !== id));
  }

  /** Start over: forget every photo (the caller has already asked the server to discard them). */
  function clear() {
    blobs.current.clear();
    setPhotos([]);
  }

  /** The server refused the photo at `index` of the submitted list (it deleted the asset). */
  function refuse(index) {
    const target = photos.filter((p) => p.status === "done")[index];
    if (target) update(target.id, { status: "refused" });
  }

  // Free the preview images when the wizard goes away.
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Submit waits until every photo is uploaded; a failed one must be retried or removed first.
  const ready = photos.every((p) => p.status === "done");
  const publicIds = photos.filter((p) => p.status === "done").map((p) => p.publicId);
  return {
    photos,
    add,
    retry: upload,
    remove,
    clear,
    refuse,
    ready,
    publicIds,
    full: photos.length >= MAX_PHOTOS,
  };
}
