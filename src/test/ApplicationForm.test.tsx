import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationForm from "@/pages/ApplicationForm";
import type { JobApplication } from "@/lib/types";

const { addApplicationMock, navigateMock, toastMock } = vi.hoisted(() => ({
  addApplicationMock: vi.fn(),
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    addApplication: addApplicationMock,
  };
});

describe("ApplicationForm", () => {
  beforeEach(() => {
    addApplicationMock.mockReset();
    navigateMock.mockReset();
    toastMock.mockReset();
  });

  it("saves brand-new applications with the canonical Applied response status by default", async () => {
    const onSaved = vi.fn();

    render(<ApplicationForm onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Job Title"), { target: { value: "Platform Engineer" } });
    fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: "Beacon Systems" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Application" }));

    // Fresh applications should land in the same Applied bucket shown by filters and analytics.
    await waitFor(() => {
      expect(addApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
        currentStatus: "Applied",
        responseStatus: "Applied",
      }));
    });
    expect(onSaved).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/app/applications");
  });

  it("offers canonical response-status labels in the form select", () => {
    render(<ApplicationForm onSaved={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("combobox")[1]);

    // Canonical labels keep the form options aligned with stored values and dashboard filters.
    expect(screen.getByRole("option", { name: "Applied" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No Response" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Offer" })).toBeInTheDocument();
  });

  it("keeps an existing custom response status available in edit mode", () => {
    const existing: JobApplication = {
      id: "app-1",
      jobTitle: "Platform Engineer",
      companyName: "Beacon Systems",
      location: "Remote",
      currentStatus: "Interview",
      responseStatus: "Interview scheduled",
      followUps: false,
      dateApplied: "2026-06-01",
      notes: "",
      followUpDate: "",
      activityLog: [],
    };

    render(<ApplicationForm existing={existing} onSaved={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("combobox")[1]);

    // Editing an imported record should not hide the saved custom stage from the select menu.
    expect(screen.getByRole("option", { name: "Interview scheduled" })).toBeInTheDocument();
  });

  it("submits a new application only once while the first cloud write is pending", async () => {
    let resolveCreate: (application: JobApplication) => void = () => undefined;
    const pendingCreate = new Promise<JobApplication>((resolve) => {
      resolveCreate = resolve;
    });
    const onCreate = vi.fn(() => pendingCreate);

    render(<ApplicationForm onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText("Job Title"), { target: { value: "Platform Engineer" } });
    fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: "Beacon Systems" } });
    const submitButton = screen.getByRole("button", { name: "Add Application" });
    const formElement = submitButton.closest("form");
    if (!formElement) throw new Error("Expected the submit button to belong to a form.");

    // Two same-tick submit events reproduce double-click and repeated-Enter races before React can repaint the button.
    fireEvent.submit(formElement);
    fireEvent.submit(formElement);

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Adding Application..." })).toBeDisabled();
    });

    await act(async () => {
      resolveCreate({
        id: "app-1",
        jobTitle: "Platform Engineer",
        companyName: "Beacon Systems",
        location: "",
        jobLink: "",
        currentStatus: "Applied",
        responseStatus: "Applied",
        followUps: false,
        dateApplied: "2026-07-15",
        notes: "",
        followUpDate: "",
        activityLog: [],
        createdAt: "2026-07-15T12:00:00.000Z",
        updatedAt: "2026-07-15T12:00:00.000Z",
      });
      await pendingCreate;
    });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/app/applications");
    });
  });

  it("keeps failed submissions retryable without navigating away", async () => {
    const onCreate = vi.fn()
      .mockRejectedValueOnce(new Error("permission denied"))
      .mockResolvedValueOnce({ id: "app-1" } as JobApplication);

    render(<ApplicationForm onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText("Job Title"), { target: { value: "Platform Engineer" } });
    fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: "Beacon Systems" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Application" }));

    await waitFor(() => {
      // Failed cloud writes should preserve the form and release the guard for an explicit retry.
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Add failed", variant: "destructive" }));
      expect(screen.getByRole("button", { name: "Add Application" })).toBeEnabled();
    });
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add Application" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(2);
      expect(navigateMock).toHaveBeenCalledWith("/app/applications");
    });
  });
});
