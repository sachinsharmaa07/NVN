// Deny by default, enforced by a test: walks the real router and fails when a route that is not on
// the public list lacks the guard chain (authenticate, loadUser, requireActive, [verified email],
// requirePermission), and then calls every such route without a token to see it really refuses.
// To add a router, add it to MOUNTS below on purpose.
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedUser, tokenFor, bearer } from "../helpers/testDb.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);
// Tag every guard that requirePermission returns with the permission it checks, so the walk can read it.
vi.mock("../../src/middleware/access.js", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    requirePermission: (permission) => {
      const guard = actual.requirePermission(permission);
      guard.permission = permission;
      return guard;
    },
    // An either-of guard is tagged with its first permission; the others must exist too.
    requireAnyPermission: (...permissions) => {
      permissions.forEach((p) => actual.requirePermission(p)); // throws on an unknown name
      const guard = actual.requireAnyPermission(...permissions);
      guard.permission = permissions[0];
      return guard;
    },
  };
});

const { createApp } = await import("../../src/app.js");
const { apiRoutes } = await import("../../src/routes/index.js");
const { healthRoutes } = await import("../../src/routes/healthRoutes.js");
const { meRoutes } = await import("../../src/routes/meRoutes.js");
const { adminUserRoutes } = await import("../../src/routes/adminUserRoutes.js");
const { geoRoutes } = await import("../../src/routes/geoRoutes.js");
const { pincodeRoutes } = await import("../../src/routes/pincodeRoutes.js");
const { waitlistRoutes } = await import("../../src/routes/waitlistRoutes.js");
const { uploadRoutes } = await import("../../src/routes/uploadRoutes.js");
const { issueRoutes } = await import("../../src/routes/issueRoutes.js");
const { staffRoutes } = await import("../../src/routes/staffRoutes.js");
const { notificationRoutes } = await import("../../src/routes/notificationRoutes.js");
const { statsRoutes } = await import("../../src/routes/statsRoutes.js");
const { communityRoutes, moderationRoutes } = await import("../../src/routes/communityRoutes.js");
const { chatRoutes } = await import("../../src/routes/chatRoutes.js");
const { citySettingsRoutes } = await import("../../src/routes/citySettingsRoutes.js");
const { auditRoutes } = await import("../../src/routes/auditRoutes.js");
const { adminWaitlistRoutes, cityAdminRoutes } =
  await import("../../src/routes/cityAdminRoutes.js");
const { departmentAdminRoutes } = await import("../../src/routes/departmentAdminRoutes.js");
const { authenticate } = await import("../../src/middleware/auth.js");
const { loadUser, requireActive, requireVerifiedEmail } =
  await import("../../src/middleware/access.js");
const { PERMISSIONS } = await import("../../src/utils/permissions.js");

useFakeAuth0();

// Every router mounted under /api, with its prefix and whether it is public.
const MOUNTS = [
  { prefix: "/health", router: healthRoutes, isPublic: true },
  { prefix: "/me", router: meRoutes },
  { prefix: "/admin/users", router: adminUserRoutes },
  { prefix: "", router: geoRoutes },
  { prefix: "/pincodes", router: pincodeRoutes, isPublic: true },
  { prefix: "/waitlist", router: waitlistRoutes, isPublic: true },
  { prefix: "/uploads", router: uploadRoutes },
  { prefix: "/issues", router: issueRoutes },
  { prefix: "/staff", router: staffRoutes },
  { prefix: "/notifications", router: notificationRoutes },
  { prefix: "/stats", router: statsRoutes, isPublic: true },
  { prefix: "/community", router: communityRoutes },
  { prefix: "/moderation", router: moderationRoutes },
  { prefix: "/chat", router: chatRoutes },
  { prefix: "/admin/city-settings", router: citySettingsRoutes },
  { prefix: "/admin/audit", router: auditRoutes },
  { prefix: "/admin/cities", router: cityAdminRoutes },
  { prefix: "/admin/departments", router: departmentAdminRoutes },
  { prefix: "/admin/waitlist", router: adminWaitlistRoutes },
];

/** Every { method, path, handlers } of a router, flattened. */
function routesOf(router, prefix) {
  const found = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const subPath = layer.route.path === "/" ? "" : layer.route.path;
    for (const method of Object.keys(layer.route.methods)) {
      found.push({
        method: method.toUpperCase(),
        path: `/api${prefix}${subPath}`,
        handlers: layer.route.stack.map((l) => l.handle),
      });
    }
  }
  return found;
}

const all = MOUNTS.flatMap((m) =>
  routesOf(m.router, m.prefix).map((r) => ({ ...r, isPublic: Boolean(m.isPublic) })),
);
const protectedRoutes = all.filter((r) => !r.isPublic);

describe("route inventory", () => {
  it("every router mounted under /api is listed in MOUNTS (a new router must be added here on purpose)", () => {
    const mounted = apiRoutes.stack.filter((l) => l.handle?.stack).map((l) => l.handle);
    const known = new Set(MOUNTS.map((m) => m.router));
    for (const router of mounted) expect(known.has(router), "unlisted router mounted").toBe(true);
    for (const m of MOUNTS) expect(mounted).toContain(m.router);
    // And no route is attached to /api directly, outside a listed router.
    expect(apiRoutes.stack.filter((l) => l.route)).toEqual([]);
    // The app really mounts apiRoutes at /api.
    expect(createApp().router.stack.some((l) => l.handle === apiRoutes)).toBe(true);
  });

  it("the inventory is not empty and covers the approved endpoints", () => {
    const names = all.map((r) => `${r.method} ${r.path}`).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        "GET /api/me",
        "PATCH /api/me",
        "GET /api/admin/users",
        "PATCH /api/admin/users/:id/role",
        "PATCH /api/admin/users/:id/status",
        "GET /api/cities",
        "GET /api/departments",
      ]),
    );
  });

  // Public POSTs that only read (a body carries the input, nothing is written). Each one is named here on purpose.
  const PUBLIC_READ_POSTS = ["POST /api/pincodes/:pin/check-point"];
  // Public writes, each IP rate-limited and idempotent. Named here on purpose.
  const PUBLIC_WRITES = ["POST /api/waitlist"];

  it("public routes are read-only (GET or a named read-only POST) or a named public write", () => {
    const publicRoutes = all.filter((r) => r.isPublic);
    expect(publicRoutes.length).toBeGreaterThan(0);
    for (const r of publicRoutes) {
      const name = `${r.method} ${r.path}`;
      const allowed = [...PUBLIC_READ_POSTS, ...PUBLIC_WRITES].includes(name);
      expect(r.method === "GET" || allowed, name).toBe(true);
    }
  });

  it.each(protectedRoutes.map((r) => [`${r.method} ${r.path}`, r]))(
    "%s has the full guard chain, in order, and a known permission",
    (_name, route) => {
      const index = (fn) => route.handlers.indexOf(fn);
      const guard = route.handlers.find((h) => h.permission);
      expect(index(authenticate), "authenticate").toBeGreaterThanOrEqual(0);
      expect(index(loadUser), "loadUser").toBeGreaterThan(index(authenticate));
      expect(index(requireActive), "requireActive").toBeGreaterThan(index(loadUser));
      expect(guard, "requirePermission").toBeDefined();
      expect(Object.keys(PERMISSIONS)).toContain(guard.permission);
      expect(
        route.handlers.indexOf(guard),
        "requirePermission after requireActive",
      ).toBeGreaterThan(index(requireActive));
      if (PERMISSIONS[guard.permission].verified) {
        expect(index(requireVerifiedEmail), "requireVerifiedEmail").toBeGreaterThan(
          index(requireActive),
        );
        expect(index(requireVerifiedEmail)).toBeLessThan(route.handlers.indexOf(guard));
      }
      // A route is never a free-for-all: "public:read" is only for the public list.
      expect(guard.permission).not.toBe("public:read");
    },
  );

  it("routes that take an :id use a permission whose scope is not 'none'", () => {
    for (const r of protectedRoutes.filter((x) => x.path.includes(":"))) {
      const guard = r.handlers.find((h) => h.permission);
      expect(PERMISSIONS[guard.permission].scope, r.path).not.toBe("none");
    }
  });
});

describe("route inventory, live calls", () => {
  useTestDb();

  it.each(protectedRoutes.map((r) => [`${r.method} ${r.path}`, r]))(
    "%s without a token answers 401, with a citizen token it never answers 2xx unless it is the user's own",
    async (_name, route) => {
      const app = createApp();
      const url = route.path.replace(":id", "64b000000000000000000001");
      const call = (token) => {
        const req = request(app)[route.method.toLowerCase()](url);
        return token ? req.set(bearer(token)).send({}) : req.send({});
      };
      expect((await call(null)).status).toBe(401);

      const citizen = await seedUser("citizen");
      const res = await call(tokenFor(citizen));
      const guard = route.handlers.find((h) => h.permission);
      const citizenMay = PERMISSIONS[guard.permission].roles.includes("citizen");
      if (!citizenMay) expect(res.status, `${route.method} ${route.path}`).toBe(403);
    },
  );
});
