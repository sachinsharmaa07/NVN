import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, cursorFilter, pageOf } from "../../src/utils/cursor.js";
import { AppError } from "../../src/utils/AppError.js";

const ID = "65f1a2b3c4d5e6f708192a3b";
const row = (n, id = ID) => ({ createdAt: new Date(1_700_000_000_000 + n), _id: id });

describe("cursor", () => {
  it("round-trips createdAt and _id", () => {
    const text = encodeCursor(row(5));
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, safe in a query string
    expect(decodeCursor(text)).toEqual({ createdAt: new Date(1_700_000_000_005), _id: ID });
  });

  const b64 = (v) =>
    Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
  const bad = [
    ["empty", ""],
    ["not a string", 42],
    ["not base64 json", "!!!"],
    ["json but not an object", b64("[1]")],
    ["bad id", b64({ t: 1, i: "xyz" })],
    ["id with operator", b64({ t: 1, i: { $gt: "" } })],
    ["time as string", b64({ t: "1", i: ID })],
    ["time as float", b64({ t: 1.5, i: ID })],
    ["too long", "a".repeat(201)],
  ];
  it.each(bad)("rejects %s with 400 VALIDATION_ERROR", (_n, text) => {
    expect.assertions(3);
    try {
      decodeCursor(text);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.status).toBe(400);
      expect(e.code).toBe("VALIDATION_ERROR");
    }
  });

  it("builds the keyset filter", () => {
    const c = { createdAt: new Date(10), _id: ID };
    expect(cursorFilter(c)).toEqual({
      $or: [{ createdAt: { $lt: c.createdAt } }, { createdAt: c.createdAt, _id: { $lt: ID } }],
    });
  });

  it("pageOf drops the probe row and returns the last kept row as the cursor", () => {
    const rows = [row(3), row(2), row(1)];
    const page = pageOf(rows, 2);
    expect(page.items).toHaveLength(2);
    expect(decodeCursor(page.nextCursor)._id).toBe(ID);
    expect(decodeCursor(page.nextCursor).createdAt).toEqual(rows[1].createdAt);
  });
  it("pageOf has no cursor on the last page", () => {
    expect(pageOf([row(1)], 2)).toEqual({ items: [row(1)], nextCursor: null });
    expect(pageOf([], 2)).toEqual({ items: [], nextCursor: null });
  });
});
