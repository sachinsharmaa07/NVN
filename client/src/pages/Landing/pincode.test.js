import { describe, expect, it } from "vitest";
import { cleanPincode, isValidPincode } from "./pincode";

describe("isValidPincode", () => {
  it.each(["144401", "110001"])("accepts %s", (value) => {
    expect(isValidPincode(value)).toBe(true);
  });

  it.each([
    ["012345", "starts with 0"],
    ["12345", "too short"],
    ["1234567", "too long"],
    ["14a401", "has a letter"],
    ["", "empty"],
  ])("rejects %s (%s)", (value) => {
    expect(isValidPincode(value)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isValidPincode(144401)).toBe(false);
    expect(isValidPincode(undefined)).toBe(false);
  });
});

describe("cleanPincode", () => {
  it("drops everything that isn't a digit and keeps at most six", () => {
    expect(cleanPincode("PIN 144 401")).toBe("144401");
    expect(cleanPincode("14a401")).toBe("14401");
    expect(cleanPincode("1234567")).toBe("123456");
    expect(cleanPincode(undefined)).toBe("");
  });
});
