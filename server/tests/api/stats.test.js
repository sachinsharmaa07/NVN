// GET /api/stats (M2 step 9): public, cached 5 minutes, no personal data.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { useTestDb } from "../helpers/testDb.js";
import { makeIssue, seedIssueWorld, HOUR } from "../helpers/issueWorld.js";

const { createApp } = await import("../../src/app.js");
const { clearStatsCache, STATS_TTL_MS } = await import("../../src/services/statsService.js");

useTestDb();
const app = createApp();

const T0 = new Date("2026-11-20T00:00:00Z");
const after = (h) => new Date(T0.getTime() + h * HOUR);
let w;
beforeEach(async () => {
  clearStatsCache();
  w = await seedIssueWorld();
});
afterEach(() => vi.useRealTimers());

describe("GET /api/stats", () => {
  it("counts reports, resolved, median hours to resolve, open by category", async () => {
    await makeIssue(w, { createdAt: T0 });
    await makeIssue(w, { createdAt: T0, category: "other", queue: "triage", departmentId: null });
    await makeIssue(w, { createdAt: T0, status: "resolved", resolvedAt: after(10) });
    await makeIssue(w, { createdAt: T0, status: "closed", resolvedAt: after(20) });
    await makeIssue(w, { createdAt: T0, status: "closed", resolvedAt: after(30) });
    await makeIssue(w, { createdAt: T0, status: "rejected" });

    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=300");
    expect(res.body).toEqual({
      totalReports: 6,
      resolved: 3,
      medianResolutionHours: 20,
      openByCategory: {
        pothole: 1,
        garbage: 0,
        streetlight: 0,
        water_leak: 0,
        drainage: 0,
        other: 1,
      },
    });
  });

  it("is null for the median when nothing is resolved yet", async () => {
    expect((await request(app).get("/api/stats")).body.medianResolutionHours).toBeNull();
  });

  it("serves the cached answer for 5 minutes, then recounts", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    expect((await request(app).get("/api/stats")).body.totalReports).toBe(0);
    await makeIssue(w);
    vi.setSystemTime(new Date(T0.getTime() + STATS_TTL_MS - 1));
    expect((await request(app).get("/api/stats")).body.totalReports).toBe(0);
    vi.setSystemTime(new Date(T0.getTime() + STATS_TTL_MS));
    expect((await request(app).get("/api/stats")).body.totalReports).toBe(1);
  });

  it("refuses query keys", async () => {
    expect((await request(app).get("/api/stats?cityId=x")).status).toBe(400);
  });
});
