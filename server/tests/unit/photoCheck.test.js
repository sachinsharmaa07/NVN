// verifyPhotos against a mocked Cloudinary Admin API (no network). Config comes from vitest.config.js:
// cloud nivaran-test, key 123456789, secret test-secret-value, NODE_ENV test.
import { describe, it, expect, vi } from "vitest";
import { verifyPhotos } from "../../src/services/photoCheckService.js";

const ID = "nivaran/test/reports/abc123";
const ID2 = "nivaran/test/reports/def456";
const asset = (over = {}) => ({
  bytes: 200_000,
  format: "jpg",
  width: 1600,
  height: 1200,
  asset_folder: "nivaran/test/reports",
  ...over,
});
const json = (status, body) => new Response(JSON.stringify(body), { status });

/** fetch mock: GET answers from `assets` (id -> asset or status number), DELETE answers `deleteStatus`. */
function fakeCloudinary(assets, { deleteStatus = 200 } = {}) {
  return vi.fn(async (url, init) => {
    if (init.method === "DELETE") return json(deleteStatus, {});
    const id = decodeURIComponent(url.split("/image/upload/")[1]);
    const a = assets[id];
    return typeof a === "number" ? json(a, {}) : a ? json(200, a) : json(404, {});
  });
}
const refused = (index) => ({ code: "INVALID_PHOTO", status: 400, details: { index } });
const deletes = (f) => f.mock.calls.filter(([, init]) => init.method === "DELETE");

describe("verifyPhotos", () => {
  it("returns publicId, width and height; asks our cloud with basic auth and a timeout", async () => {
    const f = fakeCloudinary({ [ID]: asset(), [ID2]: asset({ format: "heic", width: 800 }) });
    expect(await verifyPhotos([ID, ID2], { fetchImpl: f })).toEqual([
      { publicId: ID, width: 1600, height: 1200 },
      { publicId: ID2, width: 800, height: 1200 },
    ]);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe(`https://api.cloudinary.com/v1_1/nivaran-test/resources/image/upload/${ID}`);
    expect(init.headers.authorization).toBe(
      `Basic ${Buffer.from("123456789:test-secret-value").toString("base64")}`,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(deletes(f)).toHaveLength(0);
  });

  it("accepts exactly 5 MB", async () => {
    const f = fakeCloudinary({ [ID]: asset({ bytes: 5242880 }) });
    await expect(verifyPhotos([ID], { fetchImpl: f })).resolves.toHaveLength(1);
  });

  it.each([
    ["another folder", "nivaran/production/reports/abc"],
    ["another app", "someone/else/abc"],
    ["path traversal", "nivaran/test/reports/../../x"],
    ["a query string", "nivaran/test/reports/abc?x=1"],
    ["a sub folder", "nivaran/test/reports/a/b"],
  ])("refuses %s without calling Cloudinary", async (_, id) => {
    const f = fakeCloudinary({});
    await expect(verifyPhotos([ID, id], { fetchImpl: f })).rejects.toMatchObject(refused(1));
    expect(f).not.toHaveBeenCalled();
  });

  it("refuses a photo Cloudinary doesn't have, deleting nothing", async () => {
    const f = fakeCloudinary({});
    await expect(verifyPhotos([ID], { fetchImpl: f })).rejects.toMatchObject(refused(0));
    expect(deletes(f)).toHaveLength(0);
  });

  it.each([
    ["over 5 MB", { bytes: 5242881 }],
    ["a gif", { format: "gif" }],
    ["stored in another asset folder", { asset_folder: "elsewhere" }],
  ])("refuses and deletes a photo %s", async (_, over) => {
    const f = fakeCloudinary({ [ID]: asset(), [ID2]: asset(over) });
    await expect(verifyPhotos([ID, ID2], { fetchImpl: f })).rejects.toMatchObject(refused(1));
    expect(deletes(f).map(([url]) => url)).toEqual([
      `https://api.cloudinary.com/v1_1/nivaran-test/resources/image/upload?public_ids[]=${encodeURIComponent(ID2)}`,
    ]);
  });

  it("deletes every bad photo, not just the first", async () => {
    const f = fakeCloudinary({ [ID]: asset({ bytes: 9e6 }), [ID2]: asset({ bytes: 9e6 }) });
    await expect(verifyPhotos([ID, ID2], { fetchImpl: f })).rejects.toMatchObject(refused(0));
    expect(deletes(f)).toHaveLength(2);
  });

  it("still refuses when the delete fails", async () => {
    const f = fakeCloudinary({ [ID]: asset({ bytes: 9e6 }) }, { deleteStatus: 500 });
    await expect(verifyPhotos([ID], { fetchImpl: f })).rejects.toMatchObject(refused(0));
  });

  it.each([
    ["a timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
    ["a network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["a 500", async () => json(500, {})],
    ["a 429", async () => json(429, {})],
    ["a 401 (our keys are wrong)", async () => json(401, {})],
    ["a body that isn't JSON", async () => new Response("<html>", { status: 200 })],
  ])("is 503 UPSTREAM_UNAVAILABLE on %s", async (_, impl) => {
    await expect(verifyPhotos([ID], { fetchImpl: vi.fn(impl) })).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      status: 503,
    });
  });
});
