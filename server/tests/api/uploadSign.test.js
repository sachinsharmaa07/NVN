// POST /api/uploads/sign: Cloudinary signature with node:crypto (decision 4).
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedUser, tokenFor, bearer } from "../helpers/testDb.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { cloudinarySignature } = await import("../../src/services/uploadService.js");

useTestDb();
useFakeAuth0();
const app = createApp();

describe("cloudinarySignature", () => {
  it("matches Cloudinary's documented example", () => {
    const params = {
      timestamp: 1315060510,
      public_id: "sample_image",
      eager: "w_400,h_300,c_pad|w_260,h_200,c_crop",
    };
    expect(cloudinarySignature(params, "abcd")).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
});

describe("POST /api/uploads/sign", () => {
  it("a verified citizen gets a signature for the env folder, formats, and the 5 MB rule", async () => {
    const res = await request(app)
      .post("/api/uploads/sign")
      .set(bearer(tokenFor(await seedUser("citizen"))));
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const { signature, apiKey, uploadUrl, maxBytes, ...signed } = res.body;
    expect(signed).toMatchObject({
      folder: "nivaran/test/reports",
      allowed_formats: "jpg,png,webp,heic",
      transformation: "c_limit,w_1600,h_1600",
    });
    expect(signature).toBe(cloudinarySignature(signed, "test-secret-value"));
    expect(uploadUrl).toBe("https://api.cloudinary.com/v1_1/nivaran-test/image/upload");
    expect(apiKey).toBe("123456789");
    expect(maxBytes).toBe(5 * 1024 * 1024);
    expect(JSON.stringify(res.body)).not.toContain("test-secret-value");
  });

  it("without a token is 401", async () => {
    expect((await request(app).post("/api/uploads/sign")).status).toBe(401);
  });

  it("rejects a body (nothing for the client to choose)", async () => {
    const res = await request(app)
      .post("/api/uploads/sign")
      .set(bearer(tokenFor(await seedUser("citizen"))))
      .send({ folder: "elsewhere" });
    expect(res.status).toBe(400);
  });
});
