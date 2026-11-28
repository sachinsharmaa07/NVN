import { describe, expect, it } from "vitest";
import { sizedImage } from "./imageUrl";

const BASE = "https://res.cloudinary.com/demo/image/upload/";

describe("sizedImage", () => {
  it("inserts a size, auto format and auto quality after /upload/", () => {
    expect(sizedImage(`${BASE}v1700000000/nivaran/abc.jpg`, 400)).toBe(
      `${BASE}c_limit,w_400/f_auto/q_auto/v1700000000/nivaran/abc.jpg`,
    );
  });

  it("does not transform an already transformed URL twice", () => {
    const once = sizedImage(`${BASE}v1/nivaran/abc.jpg`, 200);
    expect(sizedImage(once, 400)).toBe(once);
  });

  it("leaves other hosts and missing URLs untouched", () => {
    expect(sizedImage("https://example.com/image/upload/abc.jpg", 400)).toBe(
      "https://example.com/image/upload/abc.jpg",
    );
    expect(sizedImage("blob:http://localhost/123", 400)).toBe("blob:http://localhost/123");
    expect(sizedImage(undefined, 400)).toBeUndefined();
  });
});
