import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthContext } from "@/components/auth/authContext";
import { SignInPromptProvider } from "@/components/auth/SignInPromptProvider";
import { useSignInPrompt } from "@/hooks/useSignInPrompt";
import { authState } from "@/test/renderWithAuth";

function Opener({ args }) {
  const { openSignIn } = useSignInPrompt();
  return <button onClick={() => openSignIn(args)}>open it</button>;
}

function setup(auth, args) {
  return render(
    <AuthContext.Provider value={auth}>
      <SignInPromptProvider>
        <Opener args={args} />
      </SignInPromptProvider>
    </AuthContext.Provider>,
  );
}

describe("SignInPrompt", () => {
  it("opens with the default wording and starts Google login for the return path", () => {
    const auth = authState("signedOut");
    setup(auth, { returnTo: "/report?pincode=144401" });
    fireEvent.click(screen.getByText("open it"));
    expect(screen.getByRole("dialog", { name: "Sign in to Nivaran" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(auth.login).toHaveBeenCalledWith("/report?pincode=144401", {
      connection: "google-oauth2",
    });
  });

  it("email and password uses the database connection", () => {
    const auth = authState("signedOut");
    setup(auth, { returnTo: "/issues" });
    fireEvent.click(screen.getByText("open it"));
    fireEvent.click(screen.getByRole("button", { name: "Use email and password" }));
    expect(auth.login).toHaveBeenCalledWith("/issues", {
      connection: "Username-Password-Authentication",
    });
  });

  it("never passes on a return path that leaves the site", () => {
    const auth = authState("signedOut");
    setup(auth, { returnTo: "//evil.example" });
    fireEvent.click(screen.getByText("open it"));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(auth.login.mock.calls[0][0]).toBe("/");
  });

  it("gated and expired variants have their own titles", () => {
    setup(authState("signedOut"), { variant: "gated" });
    fireEvent.click(screen.getByText("open it"));
    expect(screen.getByRole("dialog", { name: "Sign in to continue" })).toBeInTheDocument();
  });

  it("opens by itself, in the expired wording, when the session has ended", async () => {
    await act(async () => {
      setup(authState("signedOut", { reason: "sessionExpired" }));
    });
    expect(screen.getByRole("dialog", { name: "Your session ended" })).toBeInTheDocument();
    expect(screen.getByText("Sign in again to pick up where you left off.")).toBeInTheDocument();
  });

  it("is closed when nobody asked for it", () => {
    setup(authState("signedOut"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
