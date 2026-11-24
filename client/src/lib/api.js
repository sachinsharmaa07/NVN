import { t } from "@/i18n/t";

// Empty VITE_API_URL means "same origin" (paths like /api/health are used as they are).
const BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Every failure from this module is an ApiError, so callers only handle one shape:
 * { code: "UPPER_SNAKE", message: "readable text", status: HTTP status or 0, data: parsed body or null }
 */
export class ApiError extends Error {
  constructor({ code, message, status = 0, data = null }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

/**
 * Calls the API and returns the parsed JSON body.
 * options: method, body (sent as JSON), headers, signal (e.g. from TanStack Query), timeoutMs.
 */
export async function request(path, options = {}) {
  const { method = "GET", body, headers, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // Our own controller aborts on timeout OR when the caller's signal aborts.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (timedOut) {
      throw new ApiError({ code: "TIMEOUT", message: t("errors.common.timeout") });
    }
    if (controller.signal.aborted) {
      throw new ApiError({ code: "ABORTED", message: t("errors.common.aborted") });
    }
    // fetch only rejects on network problems (offline, DNS, CORS), never on HTTP status.
    throw Object.assign(
      new ApiError({ code: "NETWORK_ERROR", message: t("errors.common.network") }),
      {
        cause,
      },
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  const data = await parseBody(response);

  if (!response.ok) {
    // Server errors follow { error: { code, message } } (CLAUDE.md); anything else gets a generic code.
    const serverError = data?.error;
    throw new ApiError({
      code: typeof serverError?.code === "string" ? serverError.code : `HTTP_${response.status}`,
      message:
        typeof serverError?.message === "string" ? serverError.message : t("errors.common.server"),
      status: response.status,
      data,
    });
  }
  return data;
}

// Reads the body as text first so an empty or non-JSON body becomes a clear error, not a crash.
async function parseBody(response) {
  let text;
  try {
    text = await response.text();
  } catch {
    throw new ApiError({
      code: "BAD_RESPONSE",
      message: t("errors.common.badResponse"),
      status: response.status,
    });
  }
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError({
      code: "BAD_RESPONSE",
      message: t("errors.common.badResponse"),
      status: response.status,
    });
  }
}

export function apiGet(path, options) {
  return request(path, { ...options, method: "GET" });
}
