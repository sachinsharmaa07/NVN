import { describe, it, expect } from "vitest";
import { asksForOwnList, extractTicketIds, redact } from "../../src/utils/chatText.js";

describe("extractTicketIds", () => {
  it("finds ids in any case, removes repeats and keeps at most three", () => {
    expect(extractTicketIds("niv-2026-000123 and NIV-2026-000123")).toEqual(["NIV-2026-000123"]);
    const many = Array.from({ length: 5 }, (_, i) => `NIV-2026-00000${i}`).join(" ");
    expect(extractTicketIds(many)).toHaveLength(3);
  });

  it("ignores ids inside longer words or with the wrong digit count", () => {
    expect(extractTicketIds("XNIV-2026-000123 NIV-2026-12345 NIV-26-000123")).toEqual([]);
  });
});

describe("asksForOwnList", () => {
  it.each([
    ["Show my complaints", true],
    ["what is the status of my report", true],
    ["मेरी शिकायत कहाँ है", true],
    ["How do I report a pothole?", false],
    ["what does status mean", false],
  ])("%s -> %s", (text, expected) => expect(asksForOwnList(text)).toBe(expected));
});

describe("redact", () => {
  it("removes emails and Indian phone numbers before anything reaches the model", () => {
    expect(redact("mail a.b@x.in or call +91 98765 43210 or 9876543210")).toBe(
      "mail [email] or call [phone] or [phone]",
    );
  });
});
