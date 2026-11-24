import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { AdminUsers } from "./AdminUsers";

// A desktop-width screen, so the table (not the phone cards) and the Dialog (not the Drawer) show.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

const row = (id, name, extra = {}) => ({
  id,
  name,
  email: `${name.toLowerCase().replace(/ /g, ".")}@example.com`,
  role: "citizen",
  status: "active",
  canManage: true,
  emailVerified: true,
  lastLoginAt: "2026-11-20T08:00:00Z",
  ...extra,
});
const page1 = {
  items: [
    row("u10", "Ravi Kumar"),
    row("u11", "Sita Devi", { role: "moderator", status: "suspended", cityName: "Ludhiana" }),
    row("u12", "Locked Admin", { canManage: false }),
    row("u3", "Meera Iyer", { role: "city_admin" }), // the signed-in admin's own row
  ],
  nextCursor: "cur1",
};

function setup(table = {}, { path = "/admin/users", kind = "admin" } = {}) {
  const fetchSpy = fakeFetch({
    "/api/admin/users": [200, page1],
    "/api/cities": [200, { items: [{ id: "c1", name: "Ludhiana" }] }],
    ...table,
  });
  vi.stubGlobal("fetch", fetchSpy);
  const view = renderWithAuth(<AdminUsers />, {
    auth: authState(kind),
    path,
    routePath: "/admin/users",
  });
  return { fetchSpy, ...view };
}
const urlsOf = (spy, part) =>
  spy.mock.calls.map(([u]) => String(u)).filter((u) => u.includes(part));
const openActions = (name) =>
  fireEvent.keyDown(screen.getByRole("button", { name: `Actions for ${name}` }), { key: "Enter" });

describe("Admin Users", () => {
  it("a citizen gets the 403 page and no request is made", () => {
    const { fetchSpy } = setup({}, { kind: "verified" });
    expect(
      screen.getByRole("heading", { name: "You don't have access to this page" }),
    ).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders a real table with a caption, row headers, status text and an Area", async () => {
    setup();
    const table = await screen.findByRole("table", { name: "Users in your area" });
    expect(within(table).getByRole("rowheader", { name: /Ravi Kumar/ })).toBeInTheDocument();
    expect(within(table).getByText("Suspended")).toBeInTheDocument();
    expect(within(table).getByText("Ludhiana")).toBeInTheDocument();
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
  });

  it("hides Actions on the own row and on rows the server says cannot be managed", async () => {
    setup();
    await screen.findByText("Ravi Kumar");
    expect(screen.getByRole("button", { name: "Actions for Ravi Kumar" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Actions for Meera Iyer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Actions for Locked Admin" }),
    ).not.toBeInTheDocument();
  });

  it("starts with the filters from the URL and asks for 25 per page", async () => {
    const { fetchSpy } = setup({}, { path: "/admin/users?role=moderator&status=suspended" });
    await screen.findByText("Ravi Kumar");
    const url = new URL(urlsOf(fetchSpy, "/api/admin/users")[0], "http://x");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("role")).toBe("moderator");
    expect(url.searchParams.get("status")).toBe("suspended");
  });

  it("search waits 300 ms and ignores fewer than 3 characters", async () => {
    const { fetchSpy } = setup();
    await screen.findByText("Ravi Kumar");
    const input = screen.getByLabelText("Search users");
    fireEvent.change(input, { target: { value: "me" } });
    await new Promise((r) => setTimeout(r, 400));
    expect(urlsOf(fetchSpy, "q=")).toHaveLength(0);
    fireEvent.change(input, { target: { value: "meera" } });
    await waitFor(() => expect(urlsOf(fetchSpy, "q=meera")).toHaveLength(1));
  });

  it("Load more fetches the next cursor, appends rows and announces them", async () => {
    const { fetchSpy } = setup({
      "cursor=cur1": [200, { items: [row("u20", "Next Person")], nextCursor: null }],
    });
    await screen.findByText("Ravi Kumar");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Next Person")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(urlsOf(fetchSpy, "cursor=cur1")).toHaveLength(1);
    await waitFor(() => expect(screen.getByText("1 more users loaded")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("empty list, with and without filters", async () => {
    setup({ "/api/admin/users": [200, { items: [], nextCursor: null }] });
    expect(await screen.findByText("No users in your area yet")).toBeInTheDocument();
  });
  it("no match with a filter offers Clear filters", async () => {
    setup(
      { "/api/admin/users": [200, { items: [], nextCursor: null }] },
      { path: "/admin/users?role=staff" },
    );
    expect(await screen.findByText("No users match")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear filters" }).length).toBeGreaterThan(0);
  });

  it("a failed load shows an error with Try again", async () => {
    setup({ "/api/admin/users": [500, { error: { code: "INTERNAL", message: "x" } }] });
    expect(await screen.findByText("Couldn't load users. Try again.")).toBeInTheDocument();
  });

  describe("role dialog", () => {
    async function openRoleDialog() {
      const view = setup({
        "/role": [200, { user: row("u10", "Ravi Kumar", { role: "moderator" }) }],
      });
      await screen.findByText("Ravi Kumar");
      openActions("Ravi Kumar");
      fireEvent.click(await screen.findByRole("menuitem", { name: "Change role" }));
      await screen.findByRole("dialog", { name: "Change role for Ravi Kumar" });
      return view;
    }

    it("offers only roles below a city admin, requires a reason, then sends the change", async () => {
      const { fetchSpy } = await openRoleDialog();
      const confirm = () => screen.getByRole("button", { name: /Change role to/ });
      expect(confirm()).toBeDisabled();

      fireEvent.keyDown(screen.getByLabelText("New role"), { key: "Enter" });
      const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
      expect(options).toEqual(["Citizen", "Moderator", "Staff", "Department head"]);
      fireEvent.click(screen.getByRole("option", { name: "Moderator" }));

      // The scope shows only a (fixed) City for a moderator.
      expect(await screen.findByText("City")).toBeInTheDocument();
      expect(screen.queryByText("Department")).not.toBeInTheDocument();
      expect(confirm()).toBeDisabled(); // still no reason

      fireEvent.change(screen.getByLabelText("Reason for this change"), {
        target: { value: "Short" },
      });
      expect(confirm()).toBeDisabled(); // under 10 characters
      fireEvent.change(screen.getByLabelText("Reason for this change"), {
        target: { value: "Volunteered to moderate Ludhiana posts" },
      });
      expect(confirm()).toBeEnabled();
      fireEvent.click(confirm());

      await waitFor(() => expect(urlsOf(fetchSpy, "/role")).toHaveLength(1));
      const call = fetchSpy.mock.calls.find(([u]) => String(u).includes("/role"));
      expect(call[1].method).toBe("PATCH");
      expect(JSON.parse(call[1].body)).toEqual({
        role: "moderator",
        reason: "Volunteered to moderate Ludhiana posts",
        cityId: "c1",
      });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("a server 403 stays in the dialog as an alert and does not close it", async () => {
      setup({ "/role": [403, { error: { code: "FORBIDDEN", message: "raw" } }] });
      await screen.findByText("Ravi Kumar");
      openActions("Ravi Kumar");
      fireEvent.click(await screen.findByRole("menuitem", { name: "Change role" }));
      await screen.findByRole("dialog");
      fireEvent.keyDown(screen.getByLabelText("New role"), { key: "Enter" });
      fireEvent.click(await screen.findByRole("option", { name: "Citizen" }));
      fireEvent.change(screen.getByLabelText("Reason for this change"), {
        target: { value: "Moving back to citizen" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Change role to/ }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "You can't change this user's role.",
      );
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("a server 404 closes the dialog and refreshes the list", async () => {
      const { fetchSpy } = setup({
        "/role": [404, { error: { code: "NOT_FOUND", message: "x" } }],
      });
      await screen.findByText("Ravi Kumar");
      openActions("Ravi Kumar");
      fireEvent.click(await screen.findByRole("menuitem", { name: "Change role" }));
      await screen.findByRole("dialog");
      fireEvent.keyDown(screen.getByLabelText("New role"), { key: "Enter" });
      fireEvent.click(await screen.findByRole("option", { name: "Citizen" }));
      fireEvent.change(screen.getByLabelText("Reason for this change"), {
        target: { value: "Moving back to citizen" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Change role to/ }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await waitFor(() => expect(urlsOf(fetchSpy, "/api/admin/users?").length).toBeGreaterThan(1));
    });
  });

  describe("suspend and reactivate", () => {
    it("suspend needs a reason, then sends status=suspended", async () => {
      const { fetchSpy } = setup({
        "/status": [200, { user: row("u10", "Ravi Kumar", { status: "suspended" }) }],
      });
      await screen.findByText("Ravi Kumar");
      openActions("Ravi Kumar");
      fireEvent.click(await screen.findByRole("menuitem", { name: "Suspend" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Suspend Ravi Kumar?" });
      const confirm = within(dialog).getByRole("button", { name: "Suspend account" });
      expect(confirm).toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Keep account active" }),
      ).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText("Reason (shown to Ravi Kumar)"), {
        target: { value: "Posted spam repeatedly" },
      });
      fireEvent.click(confirm);
      await waitFor(() => expect(urlsOf(fetchSpy, "/status")).toHaveLength(1));
      const call = fetchSpy.mock.calls.find(([u]) => String(u).includes("/status"));
      expect(JSON.parse(call[1].body)).toEqual({
        status: "suspended",
        reason: "Posted spam repeatedly",
      });
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("a suspended user shows Reactivate, which sends status=active", async () => {
      const { fetchSpy } = setup({ "/status": [200, { user: row("u11", "Sita Devi") }] });
      await screen.findByText("Sita Devi");
      openActions("Sita Devi");
      fireEvent.click(await screen.findByRole("menuitem", { name: "Reactivate" }));
      const dialog = await screen.findByRole("alertdialog", { name: "Reactivate Sita Devi?" });
      fireEvent.change(within(dialog).getByLabelText("Reason for reactivating"), {
        target: { value: "Appeal accepted by the city" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Reactivate account" }));
      await waitFor(() => expect(urlsOf(fetchSpy, "/status")).toHaveLength(1));
      const call = fetchSpy.mock.calls.find(([u]) => String(u).includes("/status"));
      expect(JSON.parse(call[1].body).status).toBe("active");
    });

    it("a server 403 shows in the dialog and keeps it open", async () => {
      setup({ "/status": [403, { error: { code: "FORBIDDEN", message: "x" } }] });
      await screen.findByText("Ravi Kumar");
      openActions("Ravi Kumar");
      fireEvent.click(await screen.findByRole("menuitem", { name: "Suspend" }));
      const dialog = await screen.findByRole("alertdialog");
      fireEvent.change(within(dialog).getByLabelText(/Reason/), {
        target: { value: "Posted spam repeatedly" },
      });
      fireEvent.click(within(dialog).getByRole("button", { name: "Suspend account" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "You can't change this account.",
      );
    });
  });
});
