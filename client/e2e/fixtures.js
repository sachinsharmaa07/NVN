// Network fixtures for the e2e suite (ADR 0003). Every response copies a shape from docs/API.md; change both
// together. Nothing leaves localhost: any other request is aborted and fails the test at the end.
import { test as base, expect } from "@playwright/test";

export const PIN = "144601";
export const CENTROID = [75.38, 31.38]; // [lng, lat]

export const ME = {
  id: "6750e2e0e2e0e2e0e2e0e2e0",
  email: "asha@example.com",
  name: "Asha Rao",
  avatarUrl: "",
  role: "citizen",
  level: 1,
  permissions: [
    "public:read",
    "profile:read_own",
    "profile:update_own",
    "issue:create",
    "issue:read_own",
  ],
  cityId: null,
  departmentId: null,
  stateCode: null,
  status: "active",
  emailVerified: true,
  preferredLanguage: "en",
  defaultPincode: null,
};

export const KAPURTHALA = {
  pin: PIN,
  district: "Kapurthala",
  state: "Punjab",
  cityName: "Kapurthala",
  localities: ["Kapurthala", "Sultanpur Road"],
  centroid: { type: "Point", coordinates: CENTROID },
  radiusM: 4000,
  boundary: null,
  precision: "approx",
  served: true,
};

export const SIGNED = {
  uploadUrl: "https://api.cloudinary.com/v1_1/nivaran-e2e/image/upload",
  apiKey: "123456789",
  allowed_formats: "jpg,png,webp,heic",
  folder: "nivaran/development/reports",
  timestamp: 1795689600,
  transformation: "c_limit,w_1600,h_1600",
  signature: "0".repeat(40),
  maxBytes: 5242880,
};

export const CREATED = {
  ticketId: "NIV-2026-000042",
  status: "submitted",
  category: "pothole",
  title: "Deep pothole",
  pincode: PIN,
  precision: "approx",
  queue: "department",
  department: { id: "6750e2e0e2e0e2e0e2e0e2e1", name: "Roads" },
  expectedBy: "2026-12-03T11:30:00.000Z", // 3 Dec, 5:00 PM IST
  createdAt: "2026-11-26T06:30:00.000Z",
};

const notFound = { error: { code: "PINCODE_NOT_FOUND", message: "We don't know this pincode." } };
// A transparent 1x1 PNG for every map tile.
const TILE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

const json = (route, [status, body]) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

export const test = base.extend({
  /**
   * The fake backend. Tests change `api.answers` before acting (e.g. a 422 for /api/issues) and read
   * `api.requests` ({ method, path, body }) afterwards. Offsite requests fail the test.
   */
  // auto: every test gets the fake backend, even one that never touches `api` itself.
  api: [
    async ({ page }, use) => {
      const answers = {
        pincodes: { [PIN]: [200, KAPURTHALA], 999999: [404, notFound] },
        checkPoint: [200, { inside: true, precision: "approx" }],
        issues: [201, CREATED],
        issuesDelayMs: 0,
      };
      const requests = [];
      const offsite = [];

      // Registered first, so it only sees what no route below handles: the Vite dev server, or a leak.
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "localhost") return route.continue();
        offsite.push(url.href);
        return route.abort();
      });
      await page.route("https://tile.openstreetmap.org/**", (route) =>
        route.fulfill({ contentType: "image/png", body: TILE }),
      );
      await page.route("**/api/me", (route) => json(route, [200, { user: ME }]));
      await page.route(/\/api\/pincodes\/\d{6}$/, (route) => {
        const pin = route.request().url().split("/").pop();
        return json(route, answers.pincodes[pin] ?? [404, notFound]);
      });
      await page.route(/\/api\/pincodes\/\d{6}\/check-point$/, (route) =>
        json(route, answers.checkPoint),
      );
      await page.route("**/api/waitlist", (route) => json(route, [200, { joined: true }]));
      await page.route("**/api/uploads/sign", (route) => json(route, [200, SIGNED]));
      await page.route(SIGNED.uploadUrl, (route) =>
        json(route, [
          200,
          {
            public_id: `${SIGNED.folder}/e2e-photo`,
            format: "jpg",
            bytes: 700,
            width: 1,
            height: 1,
          },
        ]),
      );
      await page.route("**/api/issues", async (route) => {
        if (answers.issuesDelayMs) await new Promise((r) => setTimeout(r, answers.issuesDelayMs));
        return json(route, answers.issues);
      });

      page.on("request", (req) => {
        const url = new URL(req.url());
        if (url.pathname.startsWith("/api/") || url.hostname !== "localhost") {
          requests.push({
            method: req.method(),
            url: req.url(),
            path: url.pathname,
            body: req.postData(),
          });
        }
      });

      await use({
        answers,
        requests,
        count: (method, part) =>
          requests.filter((r) => r.method === method && r.url.includes(part)).length,
      });
      expect(offsite, "requests that tried to leave localhost").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
