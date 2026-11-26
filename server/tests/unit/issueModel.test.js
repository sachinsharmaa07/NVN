import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { Issue } from "../../src/models/Issue.js";

const id = () => new mongoose.Types.ObjectId();
const valid = (over = {}) => ({
  ticketId: "NIV-2026-000001",
  reporterId: id(),
  cityId: id(),
  pincode: "144601",
  location: { type: "Point", coordinates: [75.38, 31.38] },
  precision: "approx",
  category: "pothole",
  departmentId: id(),
  queue: "department",
  title: "Deep pothole",
  description: "A deep pothole outside the bus stand, two feet wide.",
  expectedBy: new Date(),
  idempotencyKey: "0b7e3c2a-8a51-4f7e-9d0c-6c1f4f9b2a10",
  ...over,
});
const errorsOf = (over) =>
  new Issue(valid(over)).validate().then(
    () => ({}),
    (err) => err.errors,
  );

describe("Issue model", () => {
  it("accepts a routed issue and a triage issue; status starts at submitted", async () => {
    expect(await errorsOf()).toEqual({});
    expect(await errorsOf({ category: "other", departmentId: null, queue: "triage" })).toEqual({});
    expect(new Issue(valid()).status).toBe("submitted");
  });

  it("keeps queue and departmentId consistent", async () => {
    expect(await errorsOf({ departmentId: null })).toHaveProperty("queue");
    expect(await errorsOf({ queue: "triage" })).toHaveProperty("queue");
  });

  it.each([
    ["a bad ticket id", { ticketId: "NVN-26-1" }, "ticketId"],
    ["a short description", { description: "too short" }, "description"],
    ["an unknown precision", { precision: "rough" }, "precision"],
    [
      "lat and lng swapped out of range",
      { location: { type: "Point", coordinates: [31, 95] } },
      "location.coordinates",
    ],
    ["4 photos", { photos: Array(4).fill({ publicId: "p", width: 1, height: 1 }) }, "photos"],
  ])("refuses %s", async (_, over, field) => {
    expect(await errorsOf(over)).toHaveProperty([field]);
  });
});
