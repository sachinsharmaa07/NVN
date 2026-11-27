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

// M2 shapes (docs/API.md "Issues", "Staff", "Notifications", "Stats").
export const PHOTO_URL = "https://res.cloudinary.com/nivaran-e2e/image/upload/nivaran/e2e/before";
const SUMMARY = {
  ticketId: CREATED.ticketId,
  status: "resolved",
  category: "pothole",
  title: "Deep pothole",
  pincode: PIN,
  queue: "department",
  expectedBy: CREATED.expectedBy,
  slaState: "on_track",
  onHold: false,
  version: 3,
  createdAt: CREATED.createdAt,
};
const photo = { publicId: "nivaran/e2e/before", width: 1, height: 1, url: PHOTO_URL };
export const RESOLVED = {
  ...SUMMARY,
  precision: "approx",
  department: CREATED.department,
  photos: [photo],
  afterPhotos: [{ ...photo, publicId: "nivaran/e2e/after" }],
  holdReason: null,
  timeline: [
    { status: "submitted", at: CREATED.createdAt, role: "citizen", note: null },
    { status: "assigned", at: "2026-11-26T08:00:00.000Z", role: "staff", note: null },
    { status: "in_progress", at: "2026-11-27T08:00:00.000Z", role: "staff", note: null },
    { status: "resolved", at: "2026-11-28T08:00:00.000Z", role: "staff", note: "Filled" },
  ],
};
export const STAFF_ROW = {
  ...SUMMARY,
  status: "in_progress",
  slaState: "at_risk",
  version: 2,
  description: "A deep pothole outside the bus stand, two feet wide.",
  departmentId: CREATED.department.id,
  location: { lat: CENTROID[1], lng: CENTROID[0] },
  photos: [photo],
  afterPhotos: [],
  holdReason: null,
};
export const STAFF_ME = {
  ...ME,
  id: "6750e2e0e2e0e2e0e2e0e2e9",
  email: "dev@example.com",
  name: "Dev Singh",
  role: "staff",
  level: 3,
  permissions: [
    "public:read",
    "profile:read_own",
    "profile:update_own",
    "issue:create",
    "issue:read_own",
    "issue:read_scope",
    "issue:update_status",
  ],
  cityId: "6750e2e0e2e0e2e0e2e0e2e2",
  departmentId: CREATED.department.id,
};
export const HEAD_ME = {
  ...STAFF_ME,
  id: "6750e2e0e2e0e2e0e2e0e2ea",
  email: "head@example.com",
  name: "Hari Head",
  role: "dept_head",
  level: 4,
  permissions: [...STAFF_ME.permissions, "issue:assign"],
};
export const DEPARTMENTS = [
  { id: CREATED.department.id, name: "Roads", code: "ROADS" },
  { id: "6750e2e0e2e0e2e0e2e0e2e3", name: "Water", code: "WATER" },
];

export const NOTIFICATION = {
  id: "n1",
  type: "status_changed",
  ticketId: CREATED.ticketId,
  status: "resolved",
  read: false,
  createdAt: "2026-11-28T08:00:00.000Z",
};
const listOf = (items) => [200, { items, nextCursor: null }];

// M3 community. The resident (ME with a home pincode) reads and posts in 144601.
export const POST = {
  id: "64b000000000000000000001",
  pincode: PIN,
  title: "Streetlights back on Mall Road",
  body: "All three lights near the vegetable market work again since Tuesday. Thanks to whoever reported them.",
  author: "Meera",
  mine: false,
  status: "published",
  commentCount: 2,
  createdAt: "2026-11-26T06:30:00.000Z",
};
export const MOD_ME = {
  ...ME,
  id: "6750e2e0e2e0e2e0e2e0e2e7",
  email: "nisha@example.com",
  name: "Nisha Kaur",
  role: "moderator",
  level: 2,
  permissions: [...ME.permissions, "post:create", "post:moderate"],
  cityId: "6750e2e0e2e0e2e0e2e0c001",
};
// A city admin (level 5). The fake token says MFA, so admin pages load.
export const ADMIN_ME = {
  ...MOD_ME,
  id: "6750e2e0e2e0e2e0e2e0e2e6",
  email: "meera@example.com",
  name: "Meera Iyer",
  role: "city_admin",
  level: 5,
  permissions: [...MOD_ME.permissions, "user:read_scope", "user:promote", "user:suspend"],
};
export const CITY_SETTINGS = {
  city: { id: MOD_ME.cityId, name: "Kapurthala" },
  departments: [
    { id: "6750e2e0e2e0e2e0e2e0d001", name: "Roads" },
    { id: "6750e2e0e2e0e2e0e2e0d002", name: "Water" },
  ],
  categories: ["pothole", "garbage", "streetlight", "water_leak", "drainage", "other"].map(
    (category, i) => ({
      category,
      departmentId: i < 2 ? `6750e2e0e2e0e2e0e2e0d00${i + 1}` : null,
      respondHours: 24,
      resolveHours: 72,
      hoursFrom: "national",
    }),
  ),
};
export const COMMENTS = [
  {
    id: "c1",
    parentId: null,
    body: "The one near the temple is still flickering.",
    author: "Ravi",
    mine: false,
    createdAt: "2026-11-26T08:00:00.000Z",
  },
  {
    id: "c2",
    parentId: "c1",
    body: "Reported it this morning, ticket NIV-2026-000042.",
    author: "Meera",
    mine: false,
    createdAt: "2026-11-26T09:15:00.000Z",
  },
];

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
        me: ME,
        // M2. Each may be [status, body] or a function of the request that returns one.
        mine: listOf([SUMMARY]),
        detail: [200, RESOLVED],
        writes: {}, // { confirm: [200, {...}], status: [409, ...] }
        staffIssues: listOf([STAFF_ROW]),
        notifications: [200, { items: [], nextCursor: null, unread: 0 }],
        read: [200, { updated: 0 }],
        departments: [200, { items: DEPARTMENTS }],
        feed: listOf([POST]),
        post: [200, POST],
        comments: listOf(COMMENTS),
        newPost: [201, { ...POST, mine: true }],
        newComment: [201, { id: "c3", parentId: null, body: "", author: "Asha", mine: true }],
        flags: [200, { flagged: true }],
        queue: listOf([
          { ...POST, status: "hidden", flagCount: 3, title: "Cheap repairs, call now" },
        ]),
        moderate: [200, { id: POST.id, status: "published", flagCount: 0 }],
        chat: [200, { kind: "list", tickets: [] }],
        citySettings: [200, CITY_SETTINGS],
        stats: [
          200,
          { totalReports: 0, resolved: 0, medianResolutionHours: null, openByCategory: {} },
        ],
      };
      const reply = (route, answer) =>
        json(route, typeof answer === "function" ? answer(route.request()) : answer);
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
      await page.route("**/api/me", (route) => json(route, [200, { user: answers.me }]));
      await page.route("https://res.cloudinary.com/**", (route) =>
        route.fulfill({ contentType: "image/png", body: TILE }),
      );
      await page.route(/\/api\/issues\/mine(\?.*)?$/, (route) => reply(route, answers.mine));
      await page.route(/\/api\/issues\/NIV-\d{4}-\d{6}$/, (route) => reply(route, answers.detail));
      await page.route(/\/api\/issues\/NIV-\d{4}-\d{6}\/\w+$/, (route) => {
        const action = route.request().url().split("/").pop();
        return reply(
          route,
          answers.writes[action] ?? [404, { error: { code: "NOT_FOUND", message: "x" } }],
        );
      });
      await page.route(/\/api\/staff\/issues(\?.*)?$/, (route) =>
        reply(route, answers.staffIssues),
      );
      await page.route(/\/api\/notifications(\?.*)?$/, (route) =>
        reply(route, answers.notifications),
      );
      await page.route("**/api/notifications/read", (route) => reply(route, answers.read));
      await page.route(/\/api\/community\/posts(\?.*)?$/, (route) =>
        reply(route, route.request().method() === "POST" ? answers.newPost : answers.feed),
      );
      await page.route(/\/api\/community\/posts\/\w+$/, (route) => reply(route, answers.post));
      await page.route(/\/api\/community\/posts\/\w+\/comments(\?.*)?$/, (route) =>
        reply(route, route.request().method() === "POST" ? answers.newComment : answers.comments),
      );
      await page.route(/\/api\/moderation\/queue(\?.*)?$/, (route) => reply(route, answers.queue));
      await page.route(/\/api\/moderation\/(post|comment)\/\w+$/, (route) =>
        reply(route, answers.moderate),
      );
      await page.route(/\/api\/admin\/city-settings(\/\w+)?(\?.*)?$/, (route) =>
        route.request().method() === "PUT"
          ? json(route, [
              200,
              {
                ...JSON.parse(route.request().postData()),
                category: route.request().url().split("/").pop(),
                hoursFrom: "city",
              },
            ])
          : reply(route, answers.citySettings),
      );
      await page.route("**/api/chat", (route) => reply(route, answers.chat));
      await page.route("**/api/community/flags", (route) => reply(route, answers.flags));
      await page.route("**/api/stats", (route) => reply(route, answers.stats));
      await page.route(/\/api\/departments\?cityId=\w+$/, (route) =>
        reply(route, answers.departments),
      );
      await page.route(/\/api\/pincodes\/\d{6}$/, (route) => {
        const pin = route.request().url().split("/").pop();
        return json(route, answers.pincodes[pin] ?? [404, notFound]);
      });
      await page.route(/\/api\/pincodes\/\d{6}\/check-point$/, (route) =>
        json(route, answers.checkPoint),
      );
      await page.route("**/api/waitlist", (route) => json(route, [200, { joined: true }]));
      await page.route("**/api/uploads/sign", (route) => json(route, [200, SIGNED]));
      // POST /api/uploads/discard answers 204 with no body (docs/API.md).
      await page.route("**/api/uploads/discard", (route) => route.fulfill({ status: 204 }));
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
