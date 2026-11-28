// The routes the visual and accessibility harnesses visit, with the fixture changes and actions each needs.
import {
  ADMIN_ME,
  HEAD_ME,
  MOD_ME,
  POST,
  RESOLVED,
  STAFF_ME,
  SUPER_ME,
  expect,
} from "./fixtures.js";
import { fillDetails, toDetailsStep, toMapStep } from "./steps.js";

// Must match THEME_STORAGE_KEY in src/components/theme/themeContext.js.
export const THEME_KEY = "nivaran-theme";

// Later steps extend this. `setup(api)` changes fixture answers, `act(page)` reaches a state before the shot.
export const ROUTES = [
  { name: "landing", path: "/" },
  { name: "report", path: "/report" },
  // The wizard's later steps and its receipt, reached the way a person gets there.
  { name: "report-pin", path: "/report", act: toMapStep },
  { name: "report-details", path: "/report", act: toDetailsStep },
  {
    name: "report-done",
    path: "/report",
    act: async (page) => {
      await toDetailsStep(page);
      await fillDetails(page);
      await page.getByRole("button", { name: "Submit report" }).click();
      await expect(page.getByRole("heading", { name: "Report submitted" })).toBeVisible();
    },
  },
  { name: "issues", path: "/issues" },
  { name: "issue", path: `/issues/${RESOLVED.ticketId}` },
  { name: "community", path: "/community" },
  { name: "post", path: `/community/${POST.id}` },
  { name: "profile", path: "/profile" },
  { name: "notfound", path: "/nope" },
  { name: "staff", path: "/staff", setup: (api) => (api.answers.me = STAFF_ME) },
  { name: "staff-head", path: "/staff", setup: (api) => (api.answers.me = HEAD_ME) },
  {
    name: "staff-drawer",
    path: "/staff",
    setup: (api) => (api.answers.me = STAFF_ME),
    // Open the first issue: the Sheet on a laptop, the bottom Drawer on a phone.
    act: async (page) => {
      await page
        .getByRole("button", { name: /Deep pothole/ })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
  { name: "moderation", path: "/moderation", setup: (api) => (api.answers.me = MOD_ME) },
  { name: "admin-users", path: "/admin/users", setup: (api) => (api.answers.me = ADMIN_ME) },
  { name: "admin-cities", path: "/admin/cities", setup: (api) => (api.answers.me = SUPER_ME) },
  {
    name: "admin-city-add",
    path: "/admin/cities",
    setup: (api) => (api.answers.me = SUPER_ME),
    // The Add city form: a Dialog on a laptop, the draggable Drawer on a phone.
    act: async (page) => {
      await page.getByRole("button", { name: "Add city" }).click();
      await expect(page.getByRole("dialog", { name: "Add a city" })).toBeVisible();
    },
  },
  { name: "admin-waitlist", path: "/admin/waitlist", setup: (api) => (api.answers.me = SUPER_ME) },
  { name: "admin-audit", path: "/admin/audit", setup: (api) => (api.answers.me = ADMIN_ME) },
  {
    name: "city-settings",
    path: "/admin/city-settings",
    setup: (api) => (api.answers.me = ADMIN_ME),
  },
];

// Error, empty and not-found states (step 12): one shot each at 360 light, where they're tightest.
const DOWN = [503, { error: { code: "DB_UNAVAILABLE", message: "x" } }];
const GONE = [404, { error: { code: "NOT_FOUND", message: "x" } }];
const EMPTY = [200, { items: [], nextCursor: null }];
export const STATES = [
  { name: "issues-error", path: "/issues", setup: (api) => (api.answers.mine = DOWN) },
  { name: "issues-empty", path: "/issues", setup: (api) => (api.answers.mine = EMPTY) },
  {
    name: "issue-error",
    path: `/issues/${RESOLVED.ticketId}`,
    setup: (api) => (api.answers.detail = DOWN),
  },
  {
    name: "issue-404",
    path: `/issues/${RESOLVED.ticketId}`,
    setup: (api) => (api.answers.detail = GONE),
  },
  { name: "post-404", path: `/community/${POST.id}`, setup: (api) => (api.answers.post = GONE) },
  {
    name: "staff-error",
    path: "/staff",
    setup: (api) => Object.assign(api.answers, { me: STAFF_ME, staffIssues: DOWN }),
  },
  {
    name: "audit-empty",
    path: "/admin/audit",
    setup: (api) => Object.assign(api.answers, { me: ADMIN_ME, audit: EMPTY }),
  },
];
