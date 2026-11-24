import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, people, renderWithAuth } from "@/test/renderWithAuth";
import { VerifyEmail } from "./VerifyEmail";

const user = people.unverified;

function renderPage(extra = {}, returnTo = "/report") {
  return renderWithAuth(<VerifyEmail />, {
    auth: authState("unverified", extra),
    path: "/verify-email",
    routePath: "/verify-email",
    routes: { "*": <p>went to a page</p> },
    // MemoryRouter state is set through the entry object below
    state: { returnTo },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// A loading-capable Button holds its label twice (one copy hidden), so match on the button name.
const hasLabel = (text) => screen.getByRole("button", { name: text });

const resendButton = () => screen.getByRole("button", { name: /Resend/ });

describe("VerifyEmail", () => {
  it("shows the address the email went to", () => {
    renderPage();
    expect(screen.getByText(/ravi@example\.com/)).toBeInTheDocument();
  });

  it("moves on once a fresh token says the email is verified", async () => {
    const refresh = vi.fn().mockResolvedValue({ ...user, emailVerified: true });
    renderPage({ refresh });
    fireEvent.click(screen.getByRole("button", { name: "I've verified it" }));
    expect(await screen.findByText("went to a page")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("says so when it is still not verified, and stays on the page", async () => {
    renderPage({ refresh: vi.fn().mockResolvedValue(user) });
    fireEvent.click(screen.getByRole("button", { name: "I've verified it" }));
    expect(await screen.findByText(/Not verified yet/)).toBeInTheDocument();
  });

  it("shows our copy, not the server's words, when sign-in service is down, and sends the token", async () => {
    const fetchSpy = fakeFetch({
      "/api/me/resend-verification": [
        503,
        { error: { code: "AUTH_PROVIDER_UNAVAILABLE", message: "raw" } },
      ],
    });
    vi.stubGlobal("fetch", fetchSpy);
    renderPage();
    fireEvent.click(resendButton());
    expect(await screen.findByText(/couldn't reach the sign-in service/)).toBeInTheDocument();
    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("an already verified user is sent straight on", async () => {
    renderPage({ user: { ...user, emailVerified: true } });
    await waitFor(() => expect(screen.getByText("went to a page")).toBeInTheDocument());
  });

  it("never follows a return path that leaves the site", async () => {
    const refresh = vi.fn().mockResolvedValue({ ...user, emailVerified: true });
    renderPage({ refresh }, "//evil.example/steal");
    fireEvent.click(screen.getByRole("button", { name: "I've verified it" }));
    expect(await screen.findByText("went to a page")).toBeInTheDocument();
  });

  it("starts a 60 second cooldown after a resend, counts down, and announces only the end", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", fakeFetch({ "/api/me/resend-verification": [202, { sent: true }] }));
    renderPage();
    fireEvent.click(resendButton());
    await waitFor(() => expect(hasLabel("Resend in 1:00")).toBeInTheDocument());
    expect(resendButton()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/Email sent/);

    await act(() => vi.advanceTimersByTimeAsync(18_000));
    expect(hasLabel("Resend in 0:42")).toBeInTheDocument();
    // Ticks do not touch the live region.
    expect(screen.getByRole("status")).toHaveTextContent(/Email sent/);

    await act(() => vi.advanceTimersByTimeAsync(42_000));
    expect(screen.getByRole("button", { name: "Resend the email" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("You can resend the email now.");
  });

  it("429 maps to minutes copy and starts the cooldown from Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        "/api/me/resend-verification": [
          429,
          { error: { code: "RATE_LIMITED", message: "x" } },
          { "Retry-After": "1800" },
        ],
      }),
    );
    renderPage();
    fireEvent.click(resendButton());
    expect(await screen.findByText(/Try again in 30 minutes/)).toBeInTheDocument();
    expect(hasLabel("Resend in 30:00")).toBeInTheDocument();
  });

  it("409 ALREADY_VERIFIED refreshes the session and moves on", async () => {
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        "/api/me/resend-verification": [409, { error: { code: "ALREADY_VERIFIED", message: "x" } }],
      }),
    );
    const refresh = vi.fn().mockResolvedValue({ ...user, emailVerified: true });
    renderPage({ refresh });
    fireEvent.click(resendButton());
    expect(await screen.findByText("went to a page")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});
