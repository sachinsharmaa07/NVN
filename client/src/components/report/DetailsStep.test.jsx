import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authState, fakeFetch, renderWithAuth } from "@/test/renderWithAuth";
import { DetailsStep } from "./DetailsStep";
import { PhotoPicker } from "./PhotoPicker";
import { usePhotoUploads } from "./usePhotoUploads";

const upload = vi.hoisted(() => vi.fn());
vi.mock("@/lib/photoUpload", async (orig) => ({
  ...(await orig()),
  compressImage: async () => new Blob(["x"], { type: "image/jpeg" }),
  uploadToCloudinary: upload,
}));

const ready = {
  photos: [],
  add: vi.fn(),
  retry: vi.fn(),
  remove: vi.fn(),
  full: false,
  ready: true,
  publicIds: [],
};
const idle = { pending: false, error: "" };
const draft = { pincode: "144601", precision: "approx" };

function renderStep(props = {}) {
  const onSubmit = vi.fn();
  renderWithAuth(
    <DetailsStep
      draft={draft}
      uploads={ready}
      submit={idle}
      onBack={vi.fn()}
      onSubmit={onSubmit}
      {...props}
    />,
    { auth: authState("verified") },
  );
  return { onSubmit };
}
const submitButton = () => screen.getByRole("button", { name: "Submit report" });

beforeEach(() => {
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }),
  );
});
afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  upload.mockReset();
});

describe("Report step 3: details", () => {
  it("submitting empty shows each problem and focuses the first", () => {
    const { onSubmit } = renderStep();
    fireEvent.click(submitButton());
    expect(screen.getByText("Choose what the problem is.")).toBeInTheDocument();
    expect(screen.getByText("Write a title of at least 5 characters.")).toBeInTheDocument();
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Pothole or broken road" }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("counts the description live and sends trimmed values; text goes to the draft", () => {
    const { onSubmit } = renderStep();
    fireEvent.click(screen.getByRole("radio", { name: "Garbage" }));
    fireEvent.change(screen.getByLabelText("Short title"), {
      target: { value: "  Garbage pile  " },
    });
    const desc = screen.getByLabelText("What's wrong, and where exactly?");
    fireEvent.change(desc, { target: { value: "Pile by the gate" } });
    expect(screen.getByText("16 characters. Write at least 20.")).toBeInTheDocument();
    fireEvent.change(desc, { target: { value: "Pile by the school gate, three days old." } });
    expect(screen.getByText("40 of 1000 characters")).toBeInTheDocument();
    fireEvent.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith({
      category: "garbage",
      title: "Garbage pile",
      description: "Pile by the school gate, three days old.",
    });
    expect(JSON.parse(sessionStorage.getItem("nivaran.report.draft"))).toMatchObject({
      category: "garbage",
    });
  });

  it("Submit is off while sending and while a photo isn't uploaded", () => {
    renderStep({ submit: { pending: true, error: "" } });
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
  });

  it("Submit is off while a photo isn't uploaded", () => {
    renderStep({ uploads: { ...ready, ready: false } });
    expect(submitButton()).toBeDisabled();
  });
});

function Harness() {
  return <PhotoPicker uploads={usePhotoUploads()} />;
}

describe("photos", () => {
  it("a failed upload offers Retry, which signs again and finishes", async () => {
    const fetchSpy = fakeFetch({
      "/api/uploads/sign": [200, { uploadUrl: "u", apiKey: "1", signature: "s" }],
    });
    vi.stubGlobal("fetch", fetchSpy);
    upload
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ public_id: "nivaran/test/reports/a" });
    renderWithAuth(<Harness />, { auth: authState("verified") });
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Add a photo"), { target: { files: [file] } });
    expect(await screen.findByText(/Upload failed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Uploaded")).toBeInTheDocument();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });
});
