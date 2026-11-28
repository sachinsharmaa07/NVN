// M2 track and resolve end to end against the fake backend in fixtures.js (ADR 0003).
import {
  DEPARTMENTS,
  HEAD_ME,
  NOTIFICATION,
  RESOLVED,
  STAFF_ME,
  STAFF_ROW,
  expect,
  test,
} from "./fixtures.js";
import { SMALL_PHOTO } from "./steps.js";

const ID = RESOLVED.ticketId;
const sentBody = (api, part) =>
  JSON.parse(api.requests.findLast((r) => r.method !== "GET" && r.url.includes(part)).body);

test("a) resident: My issues, open the ticket, confirm it is fixed, the ticket is closed", async ({
  page,
  api,
}) => {
  api.answers.writes.confirm = [200, { ...RESOLVED, status: "closed", version: 4 }];
  await page.goto("/issues");
  await page.getByRole("link", { name: /Deep pothole/ }).click();
  await expect(page).toHaveURL(`/issues/${ID}`);
  await expect(page.getByRole("img", { name: "Photo after the fix, photo 1" })).toBeVisible();

  await page.getByRole("button", { name: "Yes, it's fixed" }).click();
  await expect(page.getByText("Ticket closed. Thanks for confirming.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Is it fixed?" })).toHaveCount(0);
  await expect(page.locator('[data-slot="status-badge"][data-status="closed"]')).toBeVisible();
  expect(sentBody(api, "/confirm")).toEqual({ version: 3 });
});

test("b) resident reopens with a reason", async ({ page, api }) => {
  api.answers.writes.reopen = [200, { ...RESOLVED, status: "reopened", version: 4 }];
  await page.goto(`/issues/${ID}`);
  await page.getByRole("button", { name: "No, reopen it" }).click();
  await page.getByLabel("What is still wrong?").fill("The hole opened again after the rain");
  await page.getByRole("button", { name: "Reopen ticket" }).click();
  await expect(page.getByText("Ticket reopened. The department has been told.")).toBeVisible();
  expect(sentBody(api, "/reopen")).toEqual({
    note: "The hole opened again after the rain",
    version: 3,
  });
});

async function openResolvePanel(page, api) {
  api.answers.me = STAFF_ME;
  await page.goto("/staff");
  await page.getByRole("button", { name: /Deep pothole/ }).click();
  await page.getByRole("button", { name: "Change status" }).click();
  await expect(page.getByRole("radio", { name: "Resolved" })).toBeChecked();
}

test("c) staff resolves from the queue with an after photo", async ({ page, api }) => {
  api.answers.writes.status = [200, { ...RESOLVED, version: 3 }];
  await openResolvePanel(page, api);
  const save = page.getByRole("button", { name: "Save status" });
  await expect(save).toBeDisabled(); // no after photo yet
  await page.locator('input[type="file"]').setInputFiles(SMALL_PHOTO);
  await expect(page.getByText("Uploaded")).toBeVisible();
  await save.click();
  await expect(page.getByText("Status changed to Resolved")).toBeVisible();
  expect(sentBody(api, "/status")).toEqual({
    status: "resolved",
    afterPhotoPublicIds: ["nivaran/development/reports/e2e-photo"],
    version: 2,
  });
});

test("d) staff on a stale version gets the 409 message and the queue refetches", async ({
  page,
  api,
}) => {
  api.answers.writes.status = [409, { error: { code: "CONFLICT", message: "x" } }];
  await openResolvePanel(page, api);
  await page.locator('input[type="file"]').setInputFiles(SMALL_PHOTO);
  await expect(page.getByText("Uploaded")).toBeVisible();
  const before = api.count("GET", "/api/staff/issues");
  // The next read shows the newer version someone else saved.
  api.answers.staffIssues = [200, { items: [{ ...STAFF_ROW, version: 5 }], nextCursor: null }];
  await page.getByRole("button", { name: "Save status" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "This ticket changed. Showing the latest." }),
  ).toBeVisible();
  await expect.poll(() => api.count("GET", "/api/staff/issues")).toBeGreaterThan(before);
});

test("e) the bell shows the unread count; Mark all as read sets it to 0", async ({ page, api }) => {
  let unread = 1;
  api.answers.notifications = () => [
    200,
    { items: [{ ...NOTIFICATION, read: unread === 0 }], nextCursor: null, unread },
  ];
  api.answers.read = () => {
    unread = 0;
    return [200, { updated: 1 }];
  };
  await page.goto("/issues");
  const bell = page.getByRole("button", { name: "Notifications, 1 unread" });
  await expect(bell).toBeVisible();
  await expect(page.getByTestId("unread-count")).toHaveText("1");
  await bell.click();
  await expect(page.getByText(`${ID} is now Resolved`)).toBeVisible();
  await page.getByRole("menuitem", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
  await expect(page.getByTestId("unread-count")).toHaveCount(0);
  expect(sentBody(api, "/api/notifications/read")).toEqual({});
});

test("f) a citizen visiting /staff sees the 403 in place", async ({ page, api }) => {
  await page.goto("/staff");
  await expect(
    page.getByRole("heading", { name: "You don't have access to this page" }),
  ).toBeVisible();
  await expect(page).toHaveURL("/staff");
  expect(api.count("GET", "/api/staff/issues")).toBe(0);
});

test("g) a dept_head assigns a city triage issue to a department", async ({ page, api }) => {
  api.answers.me = HEAD_ME;
  const triageRow = { ...STAFF_ROW, status: "submitted", queue: "triage", departmentId: null };
  api.answers.staffIssues = [200, { items: [triageRow], nextCursor: null }];
  api.answers.writes.assign = [200, { ...RESOLVED, status: "assigned", version: 3 }];
  await page.goto("/staff");
  await page.getByRole("button", { name: /Deep pothole/ }).click();
  await expect(page.getByRole("button", { name: "Change status" })).toHaveCount(0);
  await page.getByRole("button", { name: "Assign department" }).click();
  await page.getByRole("combobox", { name: "Department" }).click();
  await page.getByRole("option", { name: "Water" }).click();
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByText("Assigned to Water")).toBeVisible();
  expect(sentBody(api, "/assign")).toEqual({ departmentId: DEPARTMENTS[1].id, version: 2 });
  expect(api.count("GET", `/api/departments?cityId=${HEAD_ME.cityId}`)).toBe(1);
});
