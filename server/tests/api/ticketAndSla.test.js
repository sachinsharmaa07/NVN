// Ticket counter (M1-1) and SLA seed (M1-10) against a real MongoDB.
import { describe, it, expect } from "vitest";
import { useTestDb } from "../helpers/testDb.js";
import { nextTicketId } from "../../src/services/ticketService.js";
import { seedSlaPolicies } from "../../src/services/slaService.js";
import { SlaPolicy } from "../../src/models/SlaPolicy.js";
import { CATEGORIES } from "../../src/utils/categories.js";

useTestDb();

describe("nextTicketId", () => {
  it("20 parallel calls give 20 unique, gap-free numbers", async () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const ids = await Promise.all(Array.from({ length: 20 }, () => nextTicketId(now)));
    const nums = ids.map((id) => Number(id.slice(-6))).sort((a, b) => a - b);
    expect(nums).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const id of ids) expect(id).toMatch(/^NIV-2026-\d{6}$/);
  });

  it("uses the IST year: 00:30 IST on 1 Jan is the new year, and the count restarts", async () => {
    await nextTicketId(new Date("2026-12-31T12:00:00Z"));
    expect(await nextTicketId(new Date("2026-12-31T19:00:00Z"))).toBe("NIV-2027-000001");
  });
});

describe("seedSlaPolicies", () => {
  it("dry run writes nothing; apply creates one national row per category; rerun creates 0", async () => {
    expect(await seedSlaPolicies()).toEqual({ created: CATEGORIES.length, applied: false });
    expect(await SlaPolicy.countDocuments()).toBe(0);
    await seedSlaPolicies({ apply: true });
    expect(await SlaPolicy.countDocuments({ cityId: null })).toBe(CATEGORIES.length);
    expect((await seedSlaPolicies({ apply: true })).created).toBe(0);
  });

  it("never overwrites an edited default", async () => {
    await seedSlaPolicies({ apply: true });
    await SlaPolicy.updateOne({ category: "pothole", cityId: null }, { resolveHours: 100 });
    await seedSlaPolicies({ apply: true });
    expect((await SlaPolicy.findOne({ category: "pothole" }).lean()).resolveHours).toBe(100);
  });

  it("refuses resolve shorter than respond", async () => {
    await expect(
      SlaPolicy.create({ category: "garbage", respondHours: 48, resolveHours: 12 }),
    ).rejects.toThrow(/resolveHours/);
  });
});
