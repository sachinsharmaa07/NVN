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
beforeEach(async () => {
  w = await seedIssueWorld();
  cloudinary = vi.fn(async () => new Response(JSON.stringify({ deleted: {} }), { status: 200 }));
  vi.stubGlobal("fetch", cloudinary);
});
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
    expect(cloudinary).toHaveBeenCalledTimes(1);
    const [url, init] = cloudinary.mock.calls[0];
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
