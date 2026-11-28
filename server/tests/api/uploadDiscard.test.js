// POST /api/uploads/discard: delete an abandoned draft's photos, never one an issue uses. Cloudinary is a stub.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, tokenFor, bearer } from "../helpers/testDb.js";
import { makeIssue, seedIssueWorld } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");

useTestDb();
useFakeAuth0();
const app = createApp();

const ID = (name) => `nivaran/test/reports/${name}`;
let w;
let cloudinary;
let assets; // publicId -> tags, what Cloudinary holds
beforeEach(async () => {
  w = await seedIssueWorld();
  const mine = [`u_${w.citizen._id}`];
  assets = new Map(["abc123", "def-456", "draft", "fine"].map((n) => [ID(n), mine]));
  cloudinary = vi.fn(async (url, init) => {
    if (init.method === "DELETE")
      return new Response(JSON.stringify({ deleted: {} }), { status: 200 });
    const id = decodeURIComponent(url.split("/resources/image/upload/")[1]);
    if (!assets.has(id)) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ public_id: id, tags: assets.get(id) }), { status: 200 });
  });
  vi.stubGlobal("fetch", cloudinary);
});
const deletes = () => cloudinary.mock.calls.filter(([, init]) => init.method === "DELETE");
afterEach(() => vi.unstubAllGlobals());

const discard = (body, user = w.citizen) =>
  request(app)
    .post("/api/uploads/discard")
    .set(bearer(tokenFor(user)))
    .send(body);
const code = (res) => res.body.error?.code;

describe("POST /api/uploads/discard", () => {
  it("deletes every id in one Admin API call and answers 204", async () => {
    const res = await discard({ publicIds: [ID("abc123"), ID("def-456")] });
    expect(res.status).toBe(204);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(deletes()).toHaveLength(1);
    const [url, init] = deletes()[0];
    expect(url).toBe(
      "https://api.cloudinary.com/v1_1/nivaran-test/resources/image/upload" +
        `?public_ids[]=${encodeURIComponent(ID("abc123"))}&public_ids[]=${encodeURIComponent(ID("def-456"))}`,
    );
    expect(init.method).toBe("DELETE");
    expect(init.headers.authorization).toBe(
      `Basic ${Buffer.from("123456789:test-secret-value").toString("base64")}`,
    );
  });

  it.each([
    ["another folder", "nivaran/prod/reports/abc123"],
    ["a path trick", "nivaran/test/reports/../x"],
    ["a nested path", "nivaran/test/reports/a/b"],
  ])("refuses %s with 400 INVALID_PHOTO and calls nothing", async (_, id) => {
    const res = await discard({ publicIds: [ID("fine"), id] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "INVALID_PHOTO", details: { index: 1 } });
    expect(cloudinary).not.toHaveBeenCalled();
  });

  it("is 409 and deletes nothing when any id is on an issue, as a report or an after photo", async () => {
    await makeIssue(w, { photos: [{ publicId: ID("onreport"), width: 10, height: 10 }] });
    await makeIssue(w, { afterPhotos: [{ publicId: ID("afterfix"), width: 10, height: 10 }] });
    for (const used of ["onreport", "afterfix"]) {
      const res = await discard({ publicIds: [ID("draft"), ID(used)] });
      expect(res.status).toBe(409);
      expect(code(res)).toBe("CONFLICT");
    }
    expect(cloudinary).not.toHaveBeenCalled();
  });

  it("is the same 404 for someone else's photo or an untagged one, and deletes nothing", async () => {
    assets.set(ID("theirs"), [`u_${w.reporter._id}`]);
    assets.set(ID("old"), []); // uploaded before uploads were tagged
    for (const name of ["theirs", "old"]) {
      const res = await discard({ publicIds: [ID("draft"), ID(name)] });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect(deletes()).toHaveLength(0);
  });

  it("skips ids that are already gone, and makes no delete call when nothing is left", async () => {
    expect((await discard({ publicIds: [ID("gone")] })).status).toBe(204);
    expect(deletes()).toHaveLength(0);
    expect((await discard({ publicIds: [ID("gone"), ID("draft")] })).status).toBe(204);
    expect(deletes()[0][0]).toContain(`public_ids[]=${encodeURIComponent(ID("draft"))}`);
    expect(deletes()[0][0]).not.toContain("gone");
  });

  it("is 503 when Cloudinary is unreachable or refuses", async () => {
    cloudinary.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(code(await discard({ publicIds: [ID("abc123")] }))).toBe("UPSTREAM_UNAVAILABLE");
    cloudinary.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    const res = await discard({ publicIds: [ID("abc123")] });
    expect(res.status).toBe(503);
    expect(code(res)).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("needs a token and a body of 1 to 3 ids with nothing else", async () => {
    expect(
      (
        await request(app)
          .post("/api/uploads/discard")
          .send({ publicIds: [ID("a")] })
      ).status,
    ).toBe(401);
    expect((await discard({ publicIds: [] })).status).toBe(400);
    expect((await discard({ publicIds: ["a", "b", "c", "d"].map(ID) })).status).toBe(400);
    expect((await discard({ publicIds: [ID("a")], all: true })).status).toBe(400);
    expect(cloudinary).not.toHaveBeenCalled();
  });
});
