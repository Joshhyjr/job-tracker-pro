import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationDetail from "@/pages/ApplicationDetail";
import type { JobApplication } from "@/lib/types";

const { updateApplicationMock } = vi.hoisted(() => ({
  updateApplicationMock: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
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
    updateApplicationMock.mockClear();
  });

  it("keeps response status in sync when quick actions change the current status", () => {
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
  });

  it("preserves custom response status when quick actions change the current status", () => {
    const onBack = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ApplicationDetail application={application({ currentStatus: "Applied", responseStatus: "Human reply received" })} onBack={onBack} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Interview" }));

    // Quick actions should not erase a more specific manually maintained response stage.
    expect(updateApplicationMock).toHaveBeenCalledWith(expect.objectContaining({
      currentStatus: "Interview",
      responseStatus: "Human reply received",
    }));
    expect(onUpdate).toHaveBeenCalled();
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

  it("syncs response status when the edit form changes the current status", () => {
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
  });

  it("passes the saved edit back to the app state after writing storage", () => {
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
