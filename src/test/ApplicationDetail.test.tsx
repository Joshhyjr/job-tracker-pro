import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ApplicationDetail from "@/pages/ApplicationDetail";
import type { JobApplication } from "@/lib/types";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

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
});
