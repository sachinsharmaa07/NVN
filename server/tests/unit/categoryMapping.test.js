import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { CategoryMapping } from "../../src/models/CategoryMapping.js";

const cityId = new mongoose.Types.ObjectId();
const departmentId = new mongoose.Types.ObjectId();
const errorsOf = (fields) =>
  new CategoryMapping({ cityId, ...fields }).validate().then(
    () => ({}),
    (err) => err.errors,
  );

describe("CategoryMapping model", () => {
  it("accepts a department mapping and a triage mapping", async () => {
    expect(await errorsOf({ category: "pothole", departmentId, queue: "department" })).toEqual({});
    expect(await errorsOf({ category: "pothole", queue: "triage" })).toEqual({});
  });

  it("keeps queue and departmentId consistent, and other always in triage", async () => {
    expect(await errorsOf({ category: "pothole", queue: "department" })).toHaveProperty("queue");
    expect(await errorsOf({ category: "pothole", departmentId, queue: "triage" })).toHaveProperty(
      "queue",
    );
    expect(await errorsOf({ category: "other", departmentId, queue: "department" })).toHaveProperty(
      "queue",
    );
    expect(await errorsOf({ category: "stray_animals", queue: "triage" })).toHaveProperty(
      "category",
    );
  });
});
