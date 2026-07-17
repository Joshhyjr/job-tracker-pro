import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationDetail from "@/pages/ApplicationDetail";
import type { JobApplication } from "@/lib/types";

const { getPreferredResponseStatusOrderMock, updateApplicationMock } = vi.hoisted(() => ({
  getPreferredResponseStatusOrderMock: vi.fn(),
  updateApplicationMock: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    getPreferredResponseStatusOrder: getPreferredResponseStatusOrderMock,
    updateApplication: updateApplicationMock,
  };
});

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: overrides.id ?? "app-1",
    jobTitle: overrides.jobTitle ?? "Frontend Engineer",
    companyName: overrides.companyName ?? "Acme",
    location: overrides.location ?? "Remote",
    currentStatus: overrides.currentStatus ?? "Applied",
    responseStatus: overrides.responseStatus ?? "Applied",
    followUps: overrides.followUps ?? false,
    dateApplied: overrides.dateApplied ?? "2026-06-01",
    notes: overrides.notes ?? "",
    followUpDate: overrides.followUpDate ?? "",
    activityLog: overrides.activityLog ?? [],
  };
}

describe("ApplicationDetail", () => {
  beforeEach(() => {
    getPreferredResponseStatusOrderMock.mockReturnValue([]);
    updateApplicationMock.mockClear();
  });

  it("keeps response status in sync when quick actions change the current status", async () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application({ currentStatus: "Applied", responseStatus: "No Response" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Interview" }));

    // Quick actions feed dashboard metrics and filters, so both status fields should advance together.
    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStatus: "Interview",
      responseStatus: "Interview",
    }));
    expect(onUpdate).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Offer" })).toBeEnabled());
  });

  it("saves the selected quick action response status over a previous custom status", async () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application({ currentStatus: "Applied", responseStatus: "Human reply received" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Interview" }));

    // Quick actions now intentionally save the selected response-stage label.
    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStatus: "Interview",
      responseStatus: "Interview",
    }));
    expect(onUpdate).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Offer" })).toBeEnabled());
  });

  it("falls back to default quick actions including On Hold when no XLSX status list exists", async () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application({ currentStatus: "Applied", responseStatus: "Applied" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    // The fallback action list should keep On Hold available even without an imported workbook list.
    expect(screen.getByRole("button", { name: "On Hold" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "On Hold" }));

    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStatus: "Applied",
      responseStatus: "On Hold",
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Offer" })).toBeEnabled());
  });

  it("uses XLSX-provided quick actions instead of default actions when a preferred order exists", async () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();
    getPreferredResponseStatusOrderMock.mockReturnValue(["Custom Stage", "Offer"]);

    render(
      <ApplicationDetail application={application({ currentStatus: "Applied", responseStatus: "Applied" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    // Imported status lists take over the quick actions instead of mixing in fallback defaults.
    expect(screen.getByRole("button", { name: "Custom Stage" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "On Hold" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Custom Stage" }));

    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStatus: "Applied",
      responseStatus: "Custom Stage",
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Offer" })).toBeEnabled());
  });

  it("rolls back a rejected cloud status change and releases the page for retry", async () => {
    let rejectWrite: (reason?: unknown) => void = () => undefined;
    // Keep the first write pending long enough to verify the optimistic and disabled states deterministically.
    const pendingWrite = new Promise<JobApplication>((_, reject) => {
      rejectWrite = reject;
    });
    const onUpdate = vi.fn()
      .mockReturnValueOnce(pendingWrite)
      .mockResolvedValueOnce(application({ currentStatus: "Interview", responseStatus: "Interview" }));

    render(
      <ApplicationDetail
        application={application({ currentStatus: "Applied", responseStatus: "Applied" })}
        onBack={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Interview" }));

    // Conflicting actions stay unavailable while the first cloud write is unresolved.
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Offer" })).toBeDisabled();
    expect(screen.getByText("Interview", { selector: "div.inline-flex" })).toBeInTheDocument();

    await act(async () => {
      rejectWrite(new Error("offline"));
    });

    // A failed optimistic write must disappear instead of being carried into the next successful update.
    await waitFor(() => expect(screen.getByRole("button", { name: "Interview" })).toBeEnabled());
    expect(screen.getByText("Applied", { selector: "div.inline-flex" })).toBeInTheDocument();
    expect(screen.queryByText("Applied → Interview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Interview" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Interview", { selector: "div.inline-flex" })).toBeInTheDocument();
    const retriedApplication = onUpdate.mock.calls[1][0] as JobApplication;
    expect(retriedApplication.activityLog.filter((entry) => entry.type === "status_change")).toHaveLength(1);
  });

  it("restores a rejected follow-up without duplicating it on retry", async () => {
    let rejectWrite: (reason?: unknown) => void = () => undefined;
    // A controlled rejection verifies that the note remains retryable while the optimistic timeline entry rolls back.
    const pendingWrite = new Promise<JobApplication>((_, reject) => {
      rejectWrite = reject;
    });
    const onUpdate = vi.fn()
      .mockReturnValueOnce(pendingWrite)
      .mockResolvedValueOnce(application({ followUps: true }));

    render(
      <ApplicationDetail
        application={application()}
        onBack={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );

    const noteInput = screen.getByPlaceholderText("Follow-up note...");
    fireEvent.change(noteInput, { target: { value: "Email the recruiter" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Entry" }));

    expect(noteInput).toBeDisabled();
    expect(screen.getByText("Email the recruiter", { selector: "p" })).toBeInTheDocument();

    await act(async () => {
      rejectWrite(new Error("permission denied"));
    });

    // The draft text survives for retry, but the failed activity entry no longer appears as durable history.
    await waitFor(() => expect(noteInput).toBeEnabled());
    expect(noteInput).toHaveValue("Email the recruiter");
    expect(screen.queryByText("Email the recruiter", { selector: "p" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add Entry" }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(2));
    const retriedApplication = onUpdate.mock.calls[1][0] as JobApplication;
    expect(retriedApplication.activityLog.filter((entry) => entry.message === "Email the recruiter")).toHaveLength(1);
  });

  it("keeps sidebar mutations disabled while an edit draft is open", () => {
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application()} onBack={vi.fn()} onUpdate={onUpdate} onDelete={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("Frontend Engineer"), { target: { value: "Unsaved Draft Title" } });

    // Only Save may persist edited fields; status and follow-up actions cannot accidentally include the draft.
    expect(screen.getByRole("button", { name: "Interview" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Follow-up note...")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Entry" })).toBeDisabled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("refreshes the local draft when the selected application changes", () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();
    const first = application({ id: "app-1", jobTitle: "Frontend Engineer", companyName: "Acme" });
    const second = application({ id: "app-2", jobTitle: "Security Analyst", companyName: "Beacon" });

    const { rerender } = render(
      <ApplicationDetail application={first} onBack={onBack} onUpdate={onUpdate} />,
    );

    expect(screen.getByRole("heading", { name: "Frontend Engineer" })).toBeInTheDocument();
    expect(screen.getByText("Acme · Remote")).toBeInTheDocument();

    rerender(<ApplicationDetail application={second} onBack={onBack} onUpdate={onUpdate} />);

    // Detail views should follow the current route selection instead of preserving the previous record's draft state.
    expect(screen.getByRole("heading", { name: "Security Analyst" })).toBeInTheDocument();
    expect(screen.getByText("Beacon · Remote")).toBeInTheDocument();
  });

  it("syncs response status when the edit form changes the current status", async () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application({ currentStatus: "Applied", responseStatus: "Applied" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(screen.getByRole("option", { name: "Interview" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // Editing the canonical current status should not leave the response-status filters behind.
    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStatus: "Interview",
      responseStatus: "Interview",
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled());
  });

  it("passes the saved edit back to the app state after writing storage", async () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application({ jobTitle: "Frontend Engineer" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByDisplayValue("Frontend Engineer"), { target: { value: "Senior Frontend Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // The saved object is passed upward so the routed detail page and list use the same just-persisted data.
    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      jobTitle: "Senior Frontend Engineer",
    }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      jobTitle: "Senior Frontend Engineer",
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled());
  });

  it("records and displays a manual Interview to On Hold status change", async () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application({ currentStatus: "Interview", responseStatus: "Interview" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(screen.getByRole("option", { name: "On Hold" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // The history captures the exact user-facing stages, including dynamic labels that do not exist in CurrentStatus.
    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStatus: "Applied",
      responseStatus: "On Hold",
      activityLog: expect.arrayContaining([
        expect.objectContaining({ fromStatus: "Interview", toStatus: "On Hold" }),
      ]),
    }));
    expect(screen.getByText("Interview → On Hold")).toBeInTheDocument();
    expect(screen.getByText("On Hold", { selector: "div.inline-flex" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeEnabled());
  });

  it("renders older message-only status entries in the dedicated history", () => {
    render(
      <ApplicationDetail
        application={application({
          responseStatus: "On Hold",
          activityLog: [{ id: "old-entry", date: "2026-07-12T12:00:00.000Z", type: "status_change", message: "Status changed to On Hold" }],
        })}
        onBack={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    // Existing localStorage records remain readable after structured from/to fields are introduced.
    expect(screen.getByRole("heading", { name: "Status History" })).toBeInTheDocument();
    expect(screen.getByText("Status changed to On Hold")).toBeInTheDocument();
  });

  it("keeps an imported custom response status selectable while editing", () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail
        application={application({ currentStatus: "Interview", responseStatus: "Interview scheduled" })}
        onBack={onBack}
        onUpdate={onUpdate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getAllByRole("combobox")[1]);

    // Imported custom stages should remain visible so users can save other edits without losing context.
    expect(screen.getByRole("option", { name: "Interview scheduled" })).toBeInTheDocument();
  });
});
