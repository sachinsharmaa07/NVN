import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/components/auth/authContext";
import { VerifyEmail } from "./VerifyEmail";

const user = { id: "1", email: "asha@example.com", name: "Asha", emailVerified: false };

function renderPage(auth, returnTo = "/report") {
  return render(
    <AuthContext.Provider value={{ status: "signedIn", user, ...auth }}>
      <MemoryRouter initialEntries={[{ pathname: "/verify-email", state: { returnTo } }]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="*" element={<p>went to a page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("VerifyEmail", () => {
  it("shows the address the email went to", () => {
    renderPage({});
    expect(screen.getByText(/asha@example\.com/)).toBeInTheDocument();
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

  it("shows the server's words when the email cannot be resent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "RESEND_UNAVAILABLE", message: "Not yet, sorry." } }),
          {
            status: 503,
          },
        ),
      ),
    );
    renderPage({ getAuthHeaders: async () => ({ Authorization: "Bearer t" }) });
    fireEvent.click(screen.getByRole("button", { name: "Resend the email" }));
    expect(await screen.findByText("Not yet, sorry.")).toBeInTheDocument();
    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
  });

  it("an already verified user is sent straight on", async () => {
    renderPage({ user: { ...user, emailVerified: true } });
    await waitFor(() => expect(screen.getByText("went to a page")).toBeInTheDocument());
  });

  it("never follows a return path that leaves the site", async () => {
    const refresh = vi.fn().mockResolvedValue({ ...user, emailVerified: true });
    renderPage({ refresh }, "//evil.example/steal");
    fireEvent.click(screen.getByRole("button", { name: "I've verified it" }));
    // "//evil.example/steal" would be read as another site; the page falls back to "/".
    expect(await screen.findByText("went to a page")).toBeInTheDocument();
  });
});
