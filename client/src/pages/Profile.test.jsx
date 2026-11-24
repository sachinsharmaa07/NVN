import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, people, renderWithAuth } from "@/test/renderWithAuth";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Profile } from "./Profile";

afterEach(() => vi.unstubAllGlobals());

const me = { ...people.citizen, preferredLanguage: "en", defaultPincode: "" };

function setup(table, extra = {}) {
  const fetchSpy = fakeFetch(table);
  vi.stubGlobal("fetch", fetchSpy);
  return {
    fetchSpy,
    ...renderWithAuth(<Profile />, {
      auth: authState("verified", { user: me, ...extra }),
      path: "/profile",
    }),
  };
}
const nameInput = () => screen.getByLabelText("Name");
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
const sentBody = (spy) => JSON.parse(spy.mock.calls[0][1].body);

describe("Profile", () => {
  it("shows the details, a Verified badge, and role as text (the email is not an input)", () => {
    setup({});
    expect(nameInput()).toHaveValue("Asha Rao");
    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Citizen")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("an unverified user gets a link to verify instead of the badge", () => {
    renderWithAuth(<Profile />, {
      auth: authState("unverified", { user: { ...people.unverified } }),
    });
    expect(screen.getByRole("link", { name: "Verify your email" })).toHaveAttribute(
      "href",
      "/verify-email",
    );
  });

  it("a valid submit sends only the three allowed fields", async () => {
    const { fetchSpy } = setup({ "/api/me": [200, { user: { ...me, name: "Asha R" } }] });
    fireEvent.change(nameInput(), { target: { value: "Asha R" } });
    fireEvent.change(screen.getByLabelText("Default pincode (optional)"), {
      target: { value: "144401" },
    });
    save();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0][1].method).toBe("PATCH");
    expect(sentBody(fetchSpy)).toEqual({
      name: "Asha R",
      preferredLanguage: "en",
      defaultPincode: "144401",
    });
  });

  it("an empty pincode is sent as null", async () => {
    const { fetchSpy } = setup({ "/api/me": [200, { user: me }] });
    save();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(sentBody(fetchSpy).defaultPincode).toBeNull();
  });

  it("a bad pincode blocks the call and explains", async () => {
    const { fetchSpy } = setup({});
    fireEvent.change(screen.getByLabelText("Default pincode (optional)"), {
      target: { value: "012345" },
    });
    save();
    expect(
      await screen.findByText("Enter 6 digits. The first digit can't be 0."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Default pincode (optional)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("an empty name is refused before any request", async () => {
    const { fetchSpy } = setup({});
    fireEvent.change(nameInput(), { target: { value: "  " } });
    save();
    expect(await screen.findByText(/Enter your name, up to 100 characters/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a server 400 is shown on its field", async () => {
    setup({
      "/api/me": [
        400,
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "x",
            details: { fields: { defaultPincode: "Not a served pincode." } },
          },
        },
      ],
    });
    fireEvent.change(screen.getByLabelText("Default pincode (optional)"), {
      target: { value: "144401" },
    });
    save();
    expect(
      await screen.findAllByText("Enter 6 digits. The first digit can't be 0."),
    ).not.toHaveLength(0);
    expect(screen.queryByText("Not a served pincode.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Default pincode (optional)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("a network error shows inline and keeps the edits", async () => {
    setup({
      "/api/me": () => {
        throw new TypeError("offline");
      },
    });
    fireEvent.change(nameInput(), { target: { value: "Keep me" } });
    save();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't reach Nivaran/);
    expect(nameInput()).toHaveValue("Keep me");
  });

  it("a refetch of the same user while you are editing does not wipe your edits", () => {
    function Harness() {
      const [u, setU] = useState(me);
      return (
        <>
          <ProfileForm user={u} />
          <button onClick={() => setU({ ...me })}>simulate refetch</button>
        </>
      );
    }
    renderWithAuth(<Harness />, { auth: authState("verified", { user: me }) });
    fireEvent.change(nameInput(), { target: { value: "Half typed" } });
    fireEvent.click(screen.getByText("simulate refetch"));
    expect(nameInput()).toHaveValue("Half typed");
  });

  it("Cancel puts the saved values back", () => {
    setup({});
    fireEvent.change(nameInput(), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(nameInput()).toHaveValue("Asha Rao");
  });
});
