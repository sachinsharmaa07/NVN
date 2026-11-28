// Admin screens end to end against the fake backend: Cities and Waitlist (super admin), departments on
// City settings and the Audit log (city admin).
import {
  ADMIN_ME,
  AUDIT_PAGE_1,
  CITIES,
  CITY_SETTINGS,
  ME,
  SUPER_ME,
  WAITLIST,
  expect,
  test,
} from "./fixtures.js";

const FORBIDDEN = "You don't have access to this page";
const sentBody = (api, method, part) =>
  JSON.parse(api.requests.findLast((r) => r.method === method && r.url.includes(part)).body);

test("a super admin adds a city, sees a taken code on the field, and lands on Onboarding", async ({
  page,
  api,
}) => {
  api.answers.me = SUPER_ME;
  await page.goto("/admin/cities");
  await expect(page.getByRole("heading", { level: 1, name: "Cities" })).toBeVisible();

  // First try: the code is taken (409), shown on the code field.
  api.answers.createCity = [409, { error: { code: "CONFLICT", message: "Code in use" } }];
  await page.getByRole("button", { name: "Add city" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a city" });
  await dialog.getByLabel("City name").fill("Jalandhar");
  await dialog.getByLabel("City code").fill("pb-jalandhar");
  await expect(dialog.getByLabel("City code")).toHaveValue("PB-JALANDHAR");
  await dialog.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: "PB", exact: true }).click();
  await dialog.getByRole("button", { name: "Add city" }).click();
  await expect(dialog.getByText("A city with this code already exists.")).toBeVisible();

  // Second try: added (201), switched to the Onboarding tab.
  api.answers.createCity = (req) => [
    201,
    { id: "c9", status: "onboarding", ...JSON.parse(req.postData()) },
  ];
  await dialog.getByRole("button", { name: "Add city" }).click();
  await expect(page.getByText("City added as onboarding.")).toBeVisible();
  await expect(page).toHaveURL(/status=onboarding/);
  expect(sentBody(api, "POST", "/api/admin/cities")).toEqual({
    name: "Jalandhar",
    code: "PB-JALANDHAR",
    stateCode: "PB",
  });
});

test("a super admin pauses an active city and opens an onboarding one", async ({ page, api }) => {
  api.answers.me = SUPER_ME;
  await page.goto("/admin/cities");
  await page.getByRole("button", { name: "Pause city" }).click();
  await expect(page.getByRole("alertdialog", { name: `Pause ${CITIES[0].name}?` })).toBeVisible();
  await page.getByRole("alertdialog").getByRole("button", { name: "Pause city" }).click();
  await expect(page.getByText("City paused. It takes no new reports.")).toBeVisible();
  expect(sentBody(api, "PATCH", `/api/admin/cities/${CITIES[0].id}`)).toEqual({
    status: "onboarding",
  });

  await page.getByRole("tab", { name: "Onboarding" }).click();
  await expect(page).toHaveURL(/status=onboarding/);
  await page.getByRole("button", { name: "Open city" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Open city" }).click();
  await expect(page.getByText("City opened. It takes reports now.")).toBeVisible();
  expect(sentBody(api, "PATCH", `/api/admin/cities/${CITIES[1].id}`)).toEqual({ status: "active" });
});

test("the waitlist keeps the server's order, and Top 50 asks for 50", async ({ page, api }) => {
  api.answers.me = SUPER_ME;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/waitlist");
  await expect(page.getByRole("rowheader")).toHaveText(WAITLIST.map((w) => w.pin));
  expect(api.requests.some((r) => r.url.includes("/api/admin/waitlist?limit=20"))).toBe(true);
  await page.getByRole("combobox", { name: "Show" }).click();
  await page.getByRole("option", { name: "Top 50" }).click();
  await expect.poll(() => api.count("GET", "/api/admin/waitlist?limit=50")).toBe(1);
});

for (const [who, me] of [
  ["a citizen", ME],
  ["a city admin", ADMIN_ME],
]) {
  test(`${who} gets the 403 page on /admin/cities and /admin/waitlist`, async ({ page, api }) => {
    api.answers.me = me;
    for (const path of ["/admin/cities", "/admin/waitlist"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: FORBIDDEN })).toBeVisible();
    }
    expect(api.count("GET", "/api/admin/cities")).toBe(0);
  });
}

test("Manage shows Cities and Waitlist to the super admin only", async ({ page, api }) => {
  test.skip(test.info().project.name !== "desktop", "the sidebar is desktop only");
  const manage = page.getByRole("navigation", { name: "Manage" });
  api.answers.me = ADMIN_ME;
  await page.goto("/");
  await expect(manage.getByRole("link", { name: "Cities" })).toHaveCount(0);
  api.answers.me = SUPER_ME;
  await page.goto("/");
  await expect(manage.getByRole("link", { name: "Cities" })).toBeVisible();
  await expect(manage.getByRole("link", { name: "Waitlist" })).toBeVisible();
});

test("a city admin adds a department (after a taken code), picks it for a category, and renames it", async ({
  page,
  api,
}) => {
  api.answers.me = ADMIN_ME;
  // One list behind both reads, as on the server: the Departments section and the category selects.
  const departments = CITY_SETTINGS.departments.map((d, i) => ({ ...d, code: `DEPT_${i + 1}` }));
  api.answers.departments = () => [200, { items: departments }];
  api.answers.citySettings = () => [200, { ...CITY_SETTINGS, departments }];
  api.answers.createDepartment = [409, { error: { code: "CONFLICT", message: "Code in use" } }];
  await page.goto("/admin/city-settings");

  const section = page.getByRole("region", { name: "Departments" });
  await expect(section.getByText("2 departments")).toBeVisible();
  await section.getByRole("button", { name: "Add department" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a department" });
  await dialog.getByLabel("Department name").fill("Streetlights");
  await dialog.getByLabel("Code").fill("streetlights");
  await dialog.getByLabel("Department name").focus(); // leaving the code field upper-cases it
  await expect(dialog.getByLabel("Code")).toHaveValue("STREETLIGHTS");
  await dialog.getByRole("button", { name: "Add department" }).click();
  await expect(
    dialog.getByText("A department with this code already exists in this city."),
  ).toBeVisible();

  api.answers.createDepartment = (req) => {
    const added = { id: "6750e2e0e2e0e2e0e2e0d099", ...JSON.parse(req.postData()) };
    departments.push(added);
    return [201, added];
  };
  await dialog.getByRole("button", { name: "Add department" }).click();
  await expect(page.getByText("Department added.")).toBeVisible();
  expect(sentBody(api, "POST", "/api/admin/departments")).toEqual({
    name: "Streetlights",
    code: "STREETLIGHTS",
  });
  await expect(section.getByText("STREETLIGHTS", { exact: true })).toBeVisible();

  // The category selects refetched too, so the new department can take a category.
  await page.getByRole("combobox", { name: "Department" }).first().click();
  await expect(page.getByRole("option", { name: "Streetlights" })).toBeVisible();
  await page.keyboard.press("Escape");

  api.answers.renameDepartment = (req) => {
    departments[2].name = JSON.parse(req.postData()).name;
    return [200, departments[2]];
  };
  await section.getByRole("button", { name: "Rename Streetlights" }).click();
  const rename = page.getByRole("dialog", { name: "Rename department" });
  await expect(rename.getByLabel("Code")).toHaveAttribute("readonly", "");
  await rename.getByLabel("Department name").fill("Street lighting");
  await rename.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Department renamed.")).toBeVisible();
  expect(sentBody(api, "PATCH", "/api/admin/departments/6750e2e0e2e0e2e0e2e0d099")).toEqual({
    name: "Street lighting",
  });
});

test("audit log: the filters change the query, and Load more sends the cursor", async ({
  page,
  api,
}) => {
  api.answers.me = ADMIN_ME;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  await expect(page.getByRole("rowheader")).toHaveCount(AUDIT_PAGE_1.items.length);
  await expect(page.getByText("Role changed")).toBeVisible();

  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("rowheader")).toHaveCount(3);
  expect(api.requests.some((r) => r.url.includes("cursor=cursor-page-2"))).toBe(true);

  await page.getByRole("combobox", { name: "Action" }).click();
  await page.getByRole("option", { name: "Role changed" }).click();
  await expect(page).toHaveURL(/action=user.role_change/);
  await expect
    .poll(() =>
      api.requests.some((r) => r.url.includes("/api/admin/audit?limit=25&action=user.role_change")),
    )
    .toBe(true);
  await page.getByRole("combobox", { name: "Target type" }).click();
  await page.getByRole("option", { name: "City", exact: true }).click();
  await expect.poll(() => api.requests.some((r) => r.url.includes("targetType=city"))).toBe(true);
});
