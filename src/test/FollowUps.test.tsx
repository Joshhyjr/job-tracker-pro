import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FollowUps from "@/pages/FollowUps";
import { isApplicationOverdue } from "@/lib/overdue";
import type { JobApplication } from "@/lib/types";

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

function application(companyName: string, followUpDate: string, followUps = false): JobApplication {
  return { id: companyName, companyName, jobTitle: "Analyst", location: "Remote", currentStatus: "Applied", responseStatus: "Applied", dateApplied: "2026-07-01", followUpDate, followUps, notes: "Keep this note", activityLog: [] };
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
    fireEvent.click(screen.getByRole("tab", { name: "overdue" }));
    expect(screen.getByText("Thirty days")).toBeInTheDocument();
    expect(screen.queryByText("Old reminder")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "ignored" }));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
    expect(screen.queryByText("Completed reminder")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "completed" }));
    expect(screen.getByText("Completed reminder")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("completes an ignored reminder and removes its active schedule", async () => {
    const onUpdate = renderFollowUps([application("Old reminder", "2026-07-31")]);
    fireEvent.click(screen.getByRole("tab", { name: "ignored" }));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark complete" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    const saved = onUpdate.mock.calls[0][0];
    expect(saved).toMatchObject({ followUps: true, followUpDate: "", notes: "Keep this note" });
    expect(saved.activityLog[0]).toMatchObject({ type: "follow_up", message: "Completed follow-up with Old reminder" });
    expect(isApplicationOverdue(saved)).toBe(false);
    fireEvent.click(screen.getByRole("tab", { name: "completed" }));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
  });

  it("restores an ignored reminder by rescheduling it", async () => {
    const onUpdate = renderFollowUps([application("Old reminder", "2026-07-31")]);
    fireEvent.click(screen.getByRole("tab", { name: "ignored" }));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New follow-up date"), { target: { value: "2026-09-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ followUps: false, followUpDate: "2026-09-02" })));
    fireEvent.click(screen.getByRole("tab", { name: "upcoming" }));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
    expect(screen.getByText("2 days")).toBeInTheDocument();
  });

  it("preserves ignored reminders when saving fails", async () => {
    const onUpdate = vi.fn(async (_item: JobApplication): Promise<JobApplication> => { throw new Error("offline"); });
    renderFollowUps([application("Old reminder", "2026-07-31")], onUpdate);
    fireEvent.click(screen.getByRole("tab", { name: "ignored" }));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Mark complete" }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Update not saved" })));
    expect(screen.getByText("Old reminder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Old reminder" })).toBeEnabled();
  });

  it("rejects malformed reschedule dates without changing the reminder", async () => {
    const onUpdate = renderFollowUps([application("Old reminder", "2026-07-31")]);
    fireEvent.click(screen.getByRole("tab", { name: "ignored" }));
    await openActions("Old reminder");
    fireEvent.click(screen.getByRole("menuitem", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("New follow-up date"), { target: { value: "2026-02-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Invalid date" }));
  });
});
