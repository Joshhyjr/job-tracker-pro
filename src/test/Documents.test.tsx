import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Documents from "@/pages/Documents";

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
});
