import { describe, expect, it } from "vitest";
import { hasPermission, levelOf } from "@/lib/roles";
import { manageItemsFor } from "./manageItems";

// Permissions come from the role table (no `permissions` array, which would override it).
const itemsFor = (role) => {
  const user = { role };
  return manageItemsFor((p) => hasPermission(user, p), levelOf(role)).map((item) => item.to);
};

describe("manageItemsFor", () => {
  it("gives a citizen no Manage group", () => {
    expect(itemsFor("citizen")).toEqual([]);
  });

  it("gives a moderator Moderation only", () => {
    expect(itemsFor("moderator")).toEqual(["/moderation"]);
  });

  it("gives a city admin Users, City settings and Audit log, plus Moderation (city admins moderate too)", () => {
    expect(itemsFor("city_admin")).toEqual([
      "/moderation",
      "/admin/users",
      "/admin/city-settings",
      "/admin/audit",
    ]);
  });

  it("gives a super admin everything, Cities and Waitlist included; a city admin neither", () => {
    expect(itemsFor("super_admin")).toEqual(
      expect.arrayContaining(["/admin/cities", "/admin/waitlist", "/admin/audit"]),
    );
    expect(itemsFor("city_admin")).not.toContain("/admin/cities");
    expect(itemsFor("city_admin")).not.toContain("/admin/waitlist");
  });
});
