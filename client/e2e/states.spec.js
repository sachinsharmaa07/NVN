// Step 12, states pass: every data page's error, empty and not-found states against the fake backend.
// 503 is used for errors because the app never retries it, so the error shows at once.
import {
  ADMIN_ME,
  ME,
  MOD_ME,
  PIN,
  POST,
  RESOLVED,
  STAFF_ME,
  SUPER_ME,
  expect,
  test,
} from "./fixtures.js";

const DOWN = [503, { error: { code: "DB_UNAVAILABLE", message: "x" } }];
const EMPTY = [200, { items: [], nextCursor: null }];
const GONE = [404, { error: { code: "NOT_FOUND", message: "x" } }];

// One row per list page: who visits, where, which answer feeds it, and the copy each state shows.
const PAGES = [
  {
    name: "my issues",
    me: ME,
    path: "/issues",
    key: "mine",
    error: "Couldn't load your issues",
    empty: "You haven't reported anything yet",
  },
  {
    name: "community feed",
    me: { ...ME, defaultPincode: PIN },
    path: "/community",
    key: "feed",
    error: "Couldn't load these notices",
    empty: `Nothing posted in ${PIN} yet`,
  },
  {
    name: "moderation",
    me: MOD_ME,
    path: "/moderation",
    key: "queue",
    error: "Couldn't load the queue",
    empty: "Nothing waiting for review",
  },
  {
    name: "staff queue",
    me: STAFF_ME,
    path: "/staff",
    key: "staffIssues",
    error: "Couldn't load the queue",
    empty: "No open issues in your queue",
  },
  {
    name: "admin users",
    me: ADMIN_ME,
    path: "/admin/users",
    key: "adminUsers",
    error: "Couldn't load users",
    empty: "No users in your area yet",
  },
  {
    name: "admin cities",
    me: SUPER_ME,
    path: "/admin/cities",
    key: "cities",
    error: "Couldn't load cities",
    empty: "No active cities yet",
  },
  {
    name: "admin waitlist",
    me: SUPER_ME,
    path: "/admin/waitlist",
    key: "waitlist",
    error: "Couldn't load the waitlist",
    empty: "No one has joined the waitlist yet.",
  },
  {
    name: "audit log",
    me: ADMIN_ME,
    path: "/admin/audit",
    key: "audit",
    error: "Couldn't load the audit log",
    empty: "No changes recorded yet.",
  },
];

for (const p of PAGES) {
  test(`${p.name}: a failed load shows the error with Try again, which recovers`, async ({
    page,
    api,
  }) => {
    api.answers.me = p.me;
    const good = api.answers[p.key];
    api.answers[p.key] = DOWN;
    await page.goto(p.path);
    await expect(page.getByText(p.error, { exact: true })).toBeVisible();
    api.answers[p.key] = good;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText(p.error, { exact: true })).toBeHidden();
  });

  test(`${p.name}: an empty list shows the designed empty state`, async ({ page, api }) => {
    api.answers.me = p.me;
    api.answers[p.key] = EMPTY;
    await page.goto(p.path);
    await expect(page.getByText(p.empty, { exact: true })).toBeVisible();
  });
}

test("city settings: a failed load shows the error with Try again", async ({ page, api }) => {
  api.answers.me = ADMIN_ME;
  api.answers.citySettings = DOWN;
  await page.goto("/admin/city-settings");
  await expect(page.getByText("Couldn't load the settings", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("ticket: a failed load is the page error (h1, announced)", async ({ page, api }) => {
  api.answers.detail = DOWN;
  await page.goto(`/issues/${RESOLVED.ticketId}`);
  const alert = page.getByRole("alert");
  await expect(
    alert.getByRole("heading", { level: 1, name: "Couldn't load this ticket" }),
  ).toBeVisible();
});

test("ticket: an unknown ID is the designed not-found", async ({ page, api }) => {
  api.answers.detail = GONE;
  await page.goto(`/issues/${RESOLVED.ticketId}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn't find that ticket" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to My issues" })).toBeVisible();
});

test("post: a failed load is the page error; a missing post is the designed not-found", async ({
  page,
  api,
}) => {
  api.answers.me = { ...ME, defaultPincode: PIN };
  api.answers.post = DOWN;
  await page.goto(`/community/${POST.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Couldn't load this post" }),
  ).toBeVisible();

  api.answers.post = GONE;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "This post isn't here" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to Community" })).toBeVisible();
});

test("post: failed comments are an inline error under the post", async ({ page, api }) => {
  api.answers.me = { ...ME, defaultPincode: PIN };
  api.answers.comments = DOWN;
  await page.goto(`/community/${POST.id}`);
  await expect(
    page.getByRole("heading", { level: 3, name: "Couldn't load comments" }),
  ).toBeVisible();
});

test("unknown address: one h1 and the way home", async ({ page }) => {
  await page.goto("/no/such/page");
  await expect(
    page.getByRole("heading", { level: 1, name: "This page doesn't exist" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await page.getByRole("link", { name: "Go to home" }).click();
  await expect(page).toHaveURL("/");
});
