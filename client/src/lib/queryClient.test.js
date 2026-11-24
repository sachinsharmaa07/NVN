import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { shouldRetry } from "./queryClient";

describe("shouldRetry", () => {
  it("retries network errors and 5xx once", () => {
    expect(shouldRetry(0, new ApiError({ code: "NETWORK_ERROR", message: "" }))).toBe(true);
    expect(shouldRetry(0, new ApiError({ code: "HTTP_500", message: "", status: 500 }))).toBe(true);
    expect(shouldRetry(1, new ApiError({ code: "NETWORK_ERROR", message: "" }))).toBe(false);
  });

  it("never retries 4xx or a 503 'database down' answer", () => {
    expect(shouldRetry(0, new ApiError({ code: "NOT_FOUND", message: "", status: 404 }))).toBe(
      false,
    );
    expect(shouldRetry(0, new ApiError({ code: "HTTP_503", message: "", status: 503 }))).toBe(
      false,
    );
  });
});
