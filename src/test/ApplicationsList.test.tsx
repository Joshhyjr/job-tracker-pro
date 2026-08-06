import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationsList from "@/pages/ApplicationsList";
import type { JobApplication } from "@/lib/types";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    getPreferredResponseStatusOrder: () => [],
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
    dateApplied: overrides.dateApplied ?? "2026-08-05",
    notes: overrides.notes ?? "",
    followUpDate: overrides.followUpDate ?? "",
    activityLog: overrides.activityLog ?? [],
  };
}

const applications = [
  application({ id: "app-1", jobTitle: "Frontend Engineer", companyName: "Acme Labs", dateApplied: "2026-08-05" }),
  application({ id: "app-2", jobTitle: "Product Designer", companyName: "Acme Canada", currentStatus: "Interview", responseStatus: "Interview", dateApplied: "2026-07-15" }),
  application({ id: "app-3", jobTitle: "Data Analyst", companyName: "Beacon", dateApplied: "2025-08-05" }),
];

function renderList(overrides: Partial<React.ComponentProps<typeof ApplicationsList>> = {}) {
  const props = {
    applications,
    onSelect: vi.fn(),
    onUpdate: vi.fn().mockImplementation(async (item: JobApplication) => item),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  render(
    <MemoryRouter>
      <ApplicationsList {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("ApplicationsList", () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it("combines partial company and current-status filters", () => {
    renderList();

    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Interview" } });

    // Combined filters should narrow the list without matching a company from another status.
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
    expect(screen.queryByText("Data Analyst")).not.toBeInTheDocument();
  });

  it("filters calendar dates by exact date, month, and year", () => {
    renderList();
    const mode = screen.getByLabelText("Date filter");

    fireEvent.change(mode, { target: { value: "month" } });
    const value = screen.getByLabelText("Date value");
    fireEvent.change(value, { target: { value: "2026-08" } });
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Product Designer")).not.toBeInTheDocument();

    fireEvent.change(mode, { target: { value: "year" } });
    fireEvent.change(value, { target: { value: "2025" } });
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();

    fireEvent.change(mode, { target: { value: "date" } });
    fireEvent.change(value, { target: { value: "2026-07-15" } });
    // Exact matching must not pull in same-day values from another year or month.
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.queryByText("Data Analyst")).not.toBeInTheDocument();
  });

  it("filters an inclusive date range with optional boundaries", () => {
    renderList();
    // Date range is the default so both boundaries are immediately available.
    expect(screen.getByLabelText("Date filter")).toHaveValue("range");

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-07-15" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-08-05" } });

    // Both boundary dates stay included while applications outside the interval are removed.
    expect(screen.getByText("Frontend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.queryByText("Data Analyst")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-07-15" } });

    // Leaving From blank creates an open-ended upper-bound filter.
    expect(screen.queryByText("Frontend Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
  });

  it("selects and deletes only the currently filtered applications after confirmation", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderList({ onDelete });

    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Select all (2)" }));

    expect(screen.getByText("2 of 2 filtered applications selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    expect(screen.getByText(/This permanently removes only the selected applications/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    // The non-matching Beacon record must never enter the confirmed deletion batch.
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
    expect(onDelete).toHaveBeenNthCalledWith(1, "app-1");
    expect(onDelete).toHaveBeenNthCalledWith(2, "app-2");
    expect(onDelete).not.toHaveBeenCalledWith("app-3");
    await waitFor(() => expect(screen.queryByText(/filtered applications selected/)).not.toBeInTheDocument());
  });

  it("keeps failed deletions selected for a safe retry", async () => {
    const onDelete = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    renderList({ onDelete });

    fireEvent.click(screen.getByRole("button", { name: "Select all (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    // Successful rows leave the selection, while the rejected cloud row stays available for retry.
    await waitFor(() => expect(screen.getByText("1 of 3 filtered applications selected")).toBeInTheDocument());
    expect(screen.getByLabelText("Select Product Designer at Acme Canada")).toHaveAttribute("data-state", "checked");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Some applications were not deleted",
      variant: "destructive",
    }));
  });

  it("hides destructive selection controls for a linked read-only workbook", () => {
    renderList({ readOnly: true });

    // OneDrive-owned workbooks remain the editing authority while they are connected.
    expect(screen.queryByRole("button", { name: /Select all/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete selected" })).not.toBeInTheDocument();
  });

  it("keeps bulk selection out of the table header", () => {
    renderList();

    // The header remains aligned with row checkboxes without presenting an unexplained control.
    expect(screen.queryByLabelText("Select all filtered applications")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select all (3)" })).toBeInTheDocument();
  });

  it("renders one concise status toolbar without response-status duplicates", () => {
    renderList();

    // Current-status counts remain available while the redundant second badge row stays removed.
    expect(screen.getAllByRole("button", { name: "Applied (2)" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Interview (1)" })).toHaveLength(1);
  });
});
