import { describe, it, expect, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/config/db.js", () => ({ isDbUp: () => true }));

const { createApp } = await import("../../src/app.js");
const app = createApp();

describe("error responses", () => {
  it("unknown route -> 404 NOT_FOUND in the standard shape", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  });

  it("malformed JSON body -> 400 INVALID_JSON without leaking parser details", async () => {
    const res = await request(app)
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send('{"broken": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: "INVALID_JSON", message: expect.any(String) } });
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .*\.js/);
  });

  it("body over 100kb -> 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await request(app)
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ text: "x".repeat(110 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("unsupported charset -> 415 BAD_REQUEST, not a 500", async () => {
    const res = await request(app)
      .post("/api/anything")
      .set("Content-Type", "application/json; charset=klingon")
      .send("{}");
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: { code: "BAD_REQUEST", message: expect.any(String) } });
  });

  it("unknown query parameter on /api/health -> 400 VALIDATION_ERROR with details", async () => {
    const res = await request(app).get("/api/health?debug=1");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([
      { path: "", message: expect.stringContaining("debug") },
    ]);
  });
});
