import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Replace only the DB connection check; the route, controller and service run for real.
vi.mock("../../src/config/db.js", () => ({ isDbUp: vi.fn() }));

const { isDbUp } = await import("../../src/config/db.js");
const { createApp } = await import("../../src/app.js");
const app = createApp();

describe("GET /api/health", () => {
  beforeEach(() => vi.mocked(isDbUp).mockReset());

  it("returns 200 with status ok when the DB is up", async () => {
    vi.mocked(isDbUp).mockReturnValue(true);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      db: "up",
      uptime: expect.any(Number),
      version: expect.any(String),
    });
    expect(Number.isInteger(res.body.uptime)).toBe(true);
  });

  it("returns 503 with status degraded when the DB is down", async () => {
    vi.mocked(isDbUp).mockReturnValue(false);
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", db: "down" });
  });

  it("sets X-Request-Id, reusing a safe incoming id and replacing an unsafe one", async () => {
    vi.mocked(isDbUp).mockReturnValue(true);
    const fresh = await request(app).get("/api/health");
    expect(fresh.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);

    const reused = await request(app).get("/api/health").set("X-Request-Id", "trace-abc_123");
    expect(reused.headers["x-request-id"]).toBe("trace-abc_123");

    const unsafe = await request(app).get("/api/health").set("X-Request-Id", "bad id <script>");
    expect(unsafe.headers["x-request-id"]).not.toContain("script");
  });
});
