import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowUps from "@/pages/FollowUps";
import { isApplicationOverdue } from "@/lib/overdue";
import type { JobApplication } from "@/lib/types";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

function application(companyName: string, followUpDate: string, followUps = false, overrides: Partial<JobApplication> = {}): JobApplication {
  return { id: companyName, companyName, jobTitle: "Analyst", location: "Remote", currentStatus: "Applied", responseStatus: "Applied", dateApplied: "2026-07-01", followUpDate, followUps, notes: "Keep this note", activityLog: [], ...overrides };
}

function renderFollowUps(applications: JobApplication[], onUpdate = vi.fn(async (item: JobApplication) => item)) {
  function StatefulFollowUps() {
    const [items, setItems] = useState(applications);
    return <FollowUps applications={items} onUpdate={async (updated) => {
      const saved = await onUpdate(updated);
      setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
      return saved;
    }} />;
  }
  render(<MemoryRouter><StatefulFollowUps /></MemoryRouter>);
  return onUpdate;
}

async function openActions(company: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: `Actions for ${company}` }), { key: "ArrowDown" });
  await screen.findByRole("menu");
}

function getTab(name: FollowUpTabName) {
  // Counts are part of each accessible tab name, so tests match the stable label prefix.
  return screen.getByRole("tab", { name: new RegExp(`^${name} \\(`, "i") });
}

type FollowUpTabName = "all" | "upcoming" | "overdue" | "completed" | "ignored";

describe("FollowUps", () => {
  beforeEach(() => {
    // Freeze only the calendar so UI promises and menu timers continue to run normally.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 31, 12));
    toastMock.mockReset();
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("separates ignored, overdue, upcoming, and completed reminders without writes", () => {
    const onUpdate = renderFollowUps([
      application("Old reminder", "2026-07-31"),
      application("Thirty days", "2026-08-01"),
      application("Future reminder", "2026-09-01"),
      application("Completed reminder", "2026-07-01", true),
    ]);
    expect(screen.getByText("Future reminder")).toBeInTheDocument();
    expect(screen.queryByText("Old reminder")).not.toBeInTheDocument();
    fireEvent.click(getTab("overdue"));
    expect(screen.getByText("Thirty days")).toBeInTheDocument();
    expect(screen.queryByText("Old reminder")).not.toBeInTheDocument();
    fireEvent.click(getTab("ignored"));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
    expect(screen.queryByText("Completed reminder")).not.toBeInTheDocument();
    fireEvent.click(getTab("completed"));
    expect(screen.getByText("Completed reminder")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("completes an ignored reminder and removes its active schedule", async () => {
    const onUpdate = renderFollowUps([application("Old reminder", "2026-07-31")]);
    fireEvent.click(getTab("ignored"));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark complete" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const saved = onUpdate.mock.calls[0][0];
    expect(saved).toMatchObject({ followUps: true, followUpDate: "", notes: "Keep this note" });
    expect(saved.activityLog[0]).toMatchObject({ type: "follow_up", message: "Completed follow-up with Old reminder" });
    expect(isApplicationOverdue(saved)).toBe(false);
    fireEvent.click(getTab("completed"));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
  });

  it("restores an ignored reminder by rescheduling it", async () => {
    const onUpdate = renderFollowUps([application("Old reminder", "2026-07-31")]);
    fireEvent.click(getTab("ignored"));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New follow-up date"), { target: { value: "2026-09-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ followUps: false, followUpDate: "2026-09-02" })));
    fireEvent.click(getTab("upcoming"));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
    expect(screen.getByText("In 2 days")).toBeInTheDocument();
  });

  it("preserves ignored reminders when saving fails", async () => {
    const onUpdate = vi.fn(async (_item: JobApplication): Promise<JobApplication> => { throw new Error("offline"); });
    renderFollowUps([application("Old reminder", "2026-07-31")], onUpdate);
    fireEvent.click(getTab("ignored"));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark complete" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Update not saved" })));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Old reminder" })).toBeEnabled();
  });

  it("rejects malformed reschedule dates without changing the reminder", async () => {
    const onUpdate = renderFollowUps([application("Old reminder", "2026-07-31")]);
    fireEvent.click(getTab("ignored"));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New follow-up date"), { target: { value: "2026-02-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid date" }));
  });

  it("hides pending terminal reminders without writing and restores them after reopening", () => {
    const onUpdate = vi.fn(async (item: JobApplication) => item);
    const closed = [
      application("Response rejected", "2026-08-15", false, { responseStatus: "Rejected", currentStatus: "Applied" }),
      application("Current rejected", "2026-08-16", false, { responseStatus: "Applied", currentStatus: "Rejected" }),
      application("Withdrawn", "2026-08-17", false, { responseStatus: "Applied", currentStatus: "Withdrawn" }),
      application("Cancelled", "2026-08-18", false, { responseStatus: "Role Cancelled", currentStatus: "Applied" }),
      application("Offer", "2026-08-19", false, { responseStatus: "Offer", currentStatus: "Offer" }),
    ];
    const { rerender } = render(<MemoryRouter><FollowUps applications={closed} onUpdate={onUpdate} /></MemoryRouter>);

    // Hidden reminders do not inflate any tab count and remain untouched in source data.
    expect(getTab("all")).toHaveAccessibleName("all (0)");
    expect(screen.queryByText("Response rejected")).not.toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(closed[0].followUpDate).toBe("2026-08-15");

    rerender(<MemoryRouter><FollowUps applications={[{ ...closed[0], responseStatus: "Applied", currentStatus: "Applied" }]} onUpdate={onUpdate} /></MemoryRouter>);
    fireEvent.click(getTab("overdue"));
    expect(screen.getByText("Response rejected")).toBeInTheDocument();
    expect(screen.getByText("16 days overdue")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("shows only Applied and Auto-reply received pending reminders", () => {
    renderFollowUps([
      application("Applied job", "2026-09-01"),
      application("Automated reply", "2026-09-02", false, { responseStatus: "Auto-reply received" }),
      application("No response", "2026-09-03", false, { responseStatus: "No Response", currentStatus: "No Response" }),
      application("Interview", "2026-09-04", false, { responseStatus: "Interview", currentStatus: "Interview" }),
      application("On hold", "2026-09-05", false, { responseStatus: "On Hold" }),
    ]);

    // Later response stages remain stored on their applications but do not compete with initial follow-up work.
    expect(getTab("all")).toHaveAccessibleName("all (2)");
    expect(screen.getByText("Applied job")).toBeInTheDocument();
    expect(screen.getByText("Automated reply")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for No response" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for Interview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions for On hold" })).not.toBeInTheDocument();
  });

  it("changes application status inline and removes a rejected pending reminder", async () => {
    const onUpdate = renderFollowUps([application("Status company", "2026-09-01")]);
    const statusSelect = screen.getByRole("combobox", { name: "Change status for Analyst at Status company" });

    fireEvent.change(statusSelect, { target: { value: "Rejected" } });
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const saved = onUpdate.mock.calls[0][0];

    // Status changes preserve the reminder data while the shared classifier removes ineligible pending work.
    expect(saved).toMatchObject({ currentStatus: "Rejected", responseStatus: "Rejected", followUpDate: "2026-09-01" });
    expect(saved.activityLog[0]).toMatchObject({ type: "status_change", fromStatus: "Applied", toStatus: "Rejected" });
    await waitFor(() => expect(screen.queryByText("Status company")).not.toBeInTheDocument());
    expect(getTab("all")).toHaveAccessibleName("all (0)");
  });

  it("keeps completed terminal reminders visible and exposes clear table semantics", () => {
    renderFollowUps([
      application("Completed rejected", "", true, { responseStatus: "Rejected", currentStatus: "Rejected" }),
    ]);

    fireEvent.click(getTab("completed"));
    expect(screen.getByText("Completed rejected")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Follow-up reminders by application and due date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Application Status" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Follow-up" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Priority" })).not.toBeInTheDocument();

    // Arrow keys move both selection and focus through the ARIA tab set.
    const completedTab = getTab("completed");
    fireEvent.keyDown(completedTab, { key: "ArrowRight" });
    expect(getTab("ignored")).toHaveAttribute("aria-selected", "true");
    expect(getTab("ignored")).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "follow-up-tab-ignored");
  });

  it("sorts overdue reminders from oldest due date to newest", () => {
    renderFollowUps([
      application("Later overdue", "2026-08-20"),
      application("Oldest overdue", "2026-08-01"),
      application("Middle overdue", "2026-08-10"),
    ]);
    fireEvent.click(getTab("overdue"));

    // The header is the first row; actionable reminders follow in urgency order.
    const reminderRows = screen.getAllByRole("row").slice(1).map((row) => row.textContent);
    expect(reminderRows).toEqual([
      expect.stringContaining("Oldest overdue"),
      expect.stringContaining("Middle overdue"),
      expect.stringContaining("Later overdue"),
    ]);
  });
});
