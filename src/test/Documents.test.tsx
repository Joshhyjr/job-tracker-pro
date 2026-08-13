import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Documents from "@/pages/Documents";
import { isPreviewableDocumentDataUrl } from "@/lib/documentPreview";
import type { JobApplication } from "@/lib/types";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

const privateResume = {
  id: "resume-1",
  name: "private-resume.pdf",
  category: "Resumes",
  size: 1_024,
  updatedAt: "2026-08-07T12:00:00.000Z",
  dataUrl: "data:application/pdf;base64,cHJpdmF0ZQ==",
};

const marinerApplication: JobApplication = {
  id: "mariner-application",
  companyName: "Mariner",
  jobTitle: "Data Analyst",
  location: "Halifax, NS",
  currentStatus: "Applied",
  responseStatus: "Applied",
  followUps: false,
  dateApplied: "2026-08-12",
  notes: "",
  followUpDate: "",
  activityLog: [],
};

describe("Documents", () => {
  beforeEach(() => {
    localStorage.clear();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never exposes legacy owner documents in the public demo", () => {
    localStorage.setItem("job-tracker-documents-v1", JSON.stringify([privateResume]));

    render(<Documents applications={[]} mode="demo" />);

    // The legacy key may contain private owner files, so only an authenticated owner may migrate it.
    expect(screen.queryByText("private-resume.pdf")).not.toBeInTheDocument();
    expect(localStorage.getItem("job-tracker-documents-v1")).not.toBeNull();
    expect(localStorage.getItem("job-tracker-documents-v2:demo")).toBeNull();
  });

  it("migrates legacy documents into the authenticated owner's scoped key", () => {
    localStorage.setItem("job-tracker-documents-v1", JSON.stringify([privateResume]));

    render(<Documents applications={[]} mode="owner" ownerId="owner-a" />);

    // Migration preserves existing files while removing the shared key that caused the privacy boundary leak.
    expect(screen.getByText("private-resume.pdf")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("job-tracker-documents-v2:owner:owner-a") || "[]")).toEqual([privateResume]);
    expect(localStorage.getItem("job-tracker-documents-v1")).toBeNull();
  });

  it("replaces in-memory documents when the auth scope changes", async () => {
    localStorage.setItem("job-tracker-documents-v2:owner:owner-a", JSON.stringify([privateResume]));
    const { rerender } = render(<Documents applications={[]} mode="owner" ownerId="owner-a" />);
    expect(screen.getByText("private-resume.pdf")).toBeInTheDocument();

    rerender(<Documents applications={[]} mode="owner" ownerId="owner-b" />);
    await waitFor(() => expect(screen.queryByText("private-resume.pdf")).not.toBeInTheDocument());

    rerender(<Documents applications={[]} mode="demo" />);

    // Account switches and sign-out must clear rendered files, not merely switch the next persistence write.
    await waitFor(() => expect(screen.queryByText("private-resume.pdf")).not.toBeInTheDocument());
  });

  it("keeps the recoverable legacy copy when scoped migration cannot persist", () => {
    localStorage.setItem("job-tracker-documents-v1", JSON.stringify([privateResume]));
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key: string, value: string) {
      if (key === "job-tracker-documents-v2:owner:owner-a") throw new DOMException("Quota exceeded", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });

    render(<Documents applications={[]} mode="owner" ownerId="owner-a" />);

    // Failed migration can still render for the authenticated owner, but it must not destroy the only durable copy.
    expect(screen.getByText("private-resume.pdf")).toBeInTheDocument();
    expect(localStorage.getItem("job-tracker-documents-v1")).not.toBeNull();
    expect(localStorage.getItem("job-tracker-documents-v2:owner:owner-a")).toBeNull();
  });

  it("cleans up a retained legacy copy after a later scoped update succeeds", async () => {
    const storageKey = "job-tracker-documents-v2:owner:owner-a";
    localStorage.setItem("job-tracker-documents-v1", JSON.stringify([privateResume]));
    const originalSetItem = Storage.prototype.setItem;
    let blockScopedWrites = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key: string, value: string) {
      if (key === storageKey && blockScopedWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });
    render(<Documents applications={[]} mode="owner" ownerId="owner-a" />);
    expect(localStorage.getItem("job-tracker-documents-v1")).not.toBeNull();

    blockScopedWrites = false;
    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions for private-resume.pdf" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    // The successful scoped mutation becomes the recovery point before the privacy-sensitive shared key is removed.
    await waitFor(() => expect(screen.queryByText("private-resume.pdf")).not.toBeInTheDocument());
    expect(localStorage.getItem(storageKey)).toBe("[]");
    expect(localStorage.getItem("job-tracker-documents-v1")).toBeNull();
  });

  it("keeps the rendered document when a device-local update cannot persist", async () => {
    const storageKey = "job-tracker-documents-v2:owner:owner-a";
    localStorage.setItem(storageKey, JSON.stringify([privateResume]));
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key: string, value: string) {
      if (key === storageKey) throw new DOMException("Quota exceeded", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });
    render(<Documents applications={[]} mode="owner" ownerId="owner-a" />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions for private-resume.pdf" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));

    // Failed writes leave both the current UI and the last durable browser copy unchanged.
    expect(screen.getByText("private-resume.pdf")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(storageKey) || "[]")).toEqual([privateResume]);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Document not saved", variant: "destructive" }));
  });

  it("uses an exact inert MIME allowlist for document previews", () => {
    // Common inert documents remain previewable while active HTML, XML, and SVG formats are download-only.
    expect(isPreviewableDocumentDataUrl("data:application/pdf;base64,AA==")).toBe(true);
    expect(isPreviewableDocumentDataUrl("data:image/png;base64,AA==")).toBe(true);
    expect(isPreviewableDocumentDataUrl("data:text/plain;charset=utf-8,notes")).toBe(true);
    expect(isPreviewableDocumentDataUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isPreviewableDocumentDataUrl("data:application/xml,<root />")).toBe(false);
    expect(isPreviewableDocumentDataUrl("data:image/svg+xml,<svg />")).toBe(false);
  });

  it("keeps active-content uploads stored and downloadable without rendering Preview", async () => {
    const storageKey = "job-tracker-documents-v2:owner:owner-a";
    const svgDocument = {
      ...privateResume,
      id: "active-svg",
      name: "portfolio.svg",
      dataUrl: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'></svg>",
    };
    localStorage.setItem(storageKey, JSON.stringify([svgDocument]));
    render(<Documents applications={[]} mode="owner" ownerId="owner-a" />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions for portfolio.svg" }), { button: 0, ctrlKey: false });

    // Preview suppression must not delete, rewrite, or block recovery of the user's original upload.
    const download = await screen.findByRole("menuitem", { name: "Download" });
    expect(download).toHaveAttribute("href", svgDocument.dataUrl);
    expect(screen.queryByRole("menuitem", { name: "Preview" })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(storageKey) || "[]")).toEqual([svgDocument]);
  });

  it("continues rendering Preview for allowlisted PDF documents", async () => {
    localStorage.setItem("job-tracker-documents-v2:owner:owner-a", JSON.stringify([privateResume]));
    render(<Documents applications={[]} mode="owner" ownerId="owner-a" />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions for private-resume.pdf" }), { button: 0, ctrlKey: false });

    // Existing inert preview behavior remains available after the MIME gate is introduced.
    expect(await screen.findByRole("menuitem", { name: "Preview" })).toHaveAttribute("href", privateResume.dataUrl);
    expect(screen.getByRole("menuitem", { name: "Download" })).toBeInTheDocument();
  });

  it("infers a cover letter and attaches it to the uniquely matching application on upload", async () => {
    const onUpdateApplication = vi.fn().mockImplementation(async (application: JobApplication) => application);
    render(<Documents applications={[marinerApplication]} mode="demo" onUpdateApplication={onUpdateApplication} />);

    // The filename should override the default Resume tab and create the real application link in one upload.
    const file = new File(["cover letter"], "Mariner Cover Letter.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Upload document"), { target: { files: [file] } });

    await waitFor(() => expect(onUpdateApplication).toHaveBeenCalledTimes(1));
    expect(onUpdateApplication).toHaveBeenCalledWith(expect.objectContaining({
      id: marinerApplication.id,
      customFields: { "Cover Letter Used": "Mariner Cover Letter.pdf" },
    }));
    expect(screen.getByRole("tab", { name: /Cover letters/ })).toHaveAttribute("aria-selected", "true");
    expect(JSON.parse(localStorage.getItem("job-tracker-documents-v2:demo") || "[]")[0]).toEqual(expect.objectContaining({
      name: "Mariner Cover Letter.pdf",
      category: "Cover letters",
    }));
  });

  it("automatically attaches an existing Amazon SDE resume when the Documents page loads", async () => {
    const amazonResume = { ...privateResume, id: "amazon-resume", name: "Joshua_Kivaria_Amazon_SDE_Resume.pdf" };
    const amazonApplication = { ...marinerApplication, id: "amazon-sde", companyName: "Amazon", jobTitle: "Software Development Engineer (SDE)" };
    const onUpdateApplication = vi.fn().mockImplementation(async (application: JobApplication) => application);
    localStorage.setItem("job-tracker-documents-v2:demo", JSON.stringify([amazonResume]));

    render(<Documents applications={[amazonApplication]} mode="demo" onUpdateApplication={onUpdateApplication} />);

    // Existing files receive the same safe matching pass as newly uploaded files, with no user click required.
    await waitFor(() => expect(onUpdateApplication).toHaveBeenCalledTimes(1));
    expect(onUpdateApplication).toHaveBeenCalledWith(expect.objectContaining({
      id: "amazon-sde",
      customFields: { "Resume Used": "Joshua_Kivaria_Amazon_SDE_Resume.pdf" },
    }));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Document attached automatically" }));
  });

  it("keeps an existing application attachment instead of silently replacing it", async () => {
    const onUpdateApplication = vi.fn().mockImplementation(async (application: JobApplication) => application);
    const applicationWithResume = {
      ...marinerApplication,
      customFields: { "Resume Used": "Original Mariner Resume.pdf" },
    };
    const replacementResume = { ...privateResume, name: "Mariner Resume.pdf" };
    localStorage.setItem("job-tracker-documents-v2:demo", JSON.stringify([replacementResume]));
    render(<Documents applications={[applicationWithResume]} mode="demo" onUpdateApplication={onUpdateApplication} />);

    // The automatic background pass must never replace a different document already recorded on the application.
    expect(onUpdateApplication).not.toHaveBeenCalled();
  });

  it("opens manual application selection from a document action", async () => {
    const onChooseApplication = vi.fn();
    localStorage.setItem("job-tracker-documents-v2:demo", JSON.stringify([privateResume]));
    render(<Documents applications={[]} mode="demo" onChooseApplication={onChooseApplication} />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions for private-resume.pdf" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Choose existing application" }));

    // Only metadata crosses routes; the device-local data URL is deliberately excluded.
    expect(onChooseApplication).toHaveBeenCalledWith([{ id: privateResume.id, name: privateResume.name, category: "Resumes" }]);
  });

  it("selects a resume and cover letter together for one manual attachment", () => {
    const onChooseApplication = vi.fn();
    const coverLetter = { ...privateResume, id: "cover-1", name: "Mariner Cover Letter.pdf", category: "Cover letters" };
    localStorage.setItem("job-tracker-documents-v2:demo", JSON.stringify([privateResume, coverLetter]));
    render(<Documents applications={[]} mode="demo" onChooseApplication={onChooseApplication} />);

    fireEvent.click(screen.getByLabelText("Select private-resume.pdf"));
    fireEvent.click(screen.getByRole("tab", { name: /Cover letters/ }));
    fireEvent.click(screen.getByLabelText("Select Mariner Cover Letter.pdf"));
    expect(screen.getByText("2 files selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Attach selected to application" }));

    // Multi-select supports the application's two distinct document fields in one safe update.
    expect(onChooseApplication).toHaveBeenCalledWith([
      { id: privateResume.id, name: privateResume.name, category: "Resumes" },
      { id: coverLetter.id, name: coverLetter.name, category: "Cover letters" },
    ]);
  });
});
