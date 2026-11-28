import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@/i18n/t";
import { fakeFetch } from "@/test/renderWithAuth";
import { PincodeInput } from "./PincodeInput";

// The public pincode lookup: 144401 is served, 999999 is unknown, 110001 is known but not covered.
const PLACE = {
  served: true,
  cityName: "Phagwara",
  district: "Kapurthala",
  state: "Punjab",
  localities: ["Model Town"],
};
const NOT_FOUND = { error: { code: "PINCODE_NOT_FOUND", message: "We don't know that pincode." } };
beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    fakeFetch({
      "/api/pincodes/144401": [200, PLACE],
      "/api/pincodes/999999": [404, NOT_FOUND],
      "/api/pincodes/110001": [200, { ...PLACE, served: false, localities: [] }],
    }),
  ),
);
afterEach(() => vi.unstubAllGlobals());

// Stand-in for the report page: prints the URL it was opened with so the test can read it.
function ReportProbe() {
  const location = useLocation();
  return <p data-testid="report-url">{location.pathname + location.search}</p>;
}

function renderPincodeInput() {
  const router = createMemoryRouter([
    { path: "/", element: <PincodeInput /> },
    { path: "/report", element: <ReportProbe /> },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return {
    input: screen.getByLabelText(t("landing.pincode.label")),
    submit: screen.getByRole("button", { name: t("landing.pincode.submit") }),
  };
}

describe("PincodeInput", () => {
  it("is one numeric field with postal-code autofill", () => {
    const { input } = renderPincodeInput();
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "postal-code");
    expect(input).toHaveAttribute("maxlength", "6");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("strips letters and other characters as you type", () => {
    const { input } = renderPincodeInput();
    fireEvent.change(input, { target: { value: "14a4b01" } });
    expect(input).toHaveValue("14401");
    fireEvent.change(input, { target: { value: "PIN 144 401" } });
    expect(input).toHaveValue("144401");
  });

  it("shows an error and keeps focus on the field when the pincode is too short", () => {
    const { input, submit } = renderPincodeInput();
    fireEvent.change(input, { target: { value: "12345" } });
    fireEvent.click(submit);

    const message = t("landing.pincode.errorShort", { count: 5 });
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining(message));
    expect(input).toHaveFocus();
    expect(screen.queryByTestId("report-url")).not.toBeInTheDocument();
  });

  it("explains that a pincode can't start with 0", () => {
    const { input, submit } = renderPincodeInput();
    fireEvent.change(input, { target: { value: "012345" } });
    fireEvent.click(submit);
    expect(screen.getByText(t("landing.pincode.errorLeadingZero"))).toBeInTheDocument();
  });

  it("checks on blur and clears the error once the pincode is fixed", () => {
    const { input } = renderPincodeInput();
    fireEvent.change(input, { target: { value: "1444" } });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "144401" } });
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows the area for a served pincode, then opens the report page from Report in", async () => {
    const { input } = renderPincodeInput();
    fireEvent.change(input, { target: { value: "144401" } });
    expect(await screen.findByText(/Phagwara/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Report in 144401" }));
    expect(await screen.findByTestId("report-url")).toHaveTextContent("/report?pincode=144401");
  });

  it("offers the waitlist and no Report button for a pincode we don't cover", async () => {
    const { input } = renderPincodeInput();
    fireEvent.change(input, { target: { value: "110001" } });
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Report in/ })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: t("landing.pincode.submit") }),
    ).not.toBeInTheDocument();
  });

  it("offers the waitlist for a pincode that doesn't exist", async () => {
    const { input } = renderPincodeInput();
    fireEvent.change(input, { target: { value: "999999" } });
    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
  });
});
