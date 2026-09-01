import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/Dashboard";
import type { JobApplication } from "@/lib/types";

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  // Dashboard links are not under test here, so a plain anchor keeps the unit isolated from router context.
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => navigateMock,
}));
vi.mock("recharts", () => ({
  LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => <div data-testid="monthly-line-chart" data-points={data.length}>{children}</div>,
  Line: () => <div data-testid="monthly-line" />,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="status-pie-chart">{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="status-pie">{children}</div>,
  Cell: () => null,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/storage", async () => ({ ...(await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage")), getPreferredResponseStatusOrder: () => [] }));

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return { id: overrides.id ?? "app-1", jobTitle: overrides.jobTitle ?? "Data Analyst", companyName: overrides.companyName ?? "Acme", location: overrides.location ?? "Halifax, Canada", currentStatus: overrides.currentStatus ?? "Applied", responseStatus: overrides.responseStatus ?? "Applied", followUps: overrides.followUps ?? false, dateApplied: overrides.dateApplied ?? new Date().toISOString().slice(0, 10), notes: overrides.notes ?? "", followUpDate: overrides.followUpDate ?? "", activityLog: overrides.activityLog ?? [] };
}

describe("Dashboard", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("keeps ignored reminders out of the five-item queue and restores rescheduled reminders", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 31, 12));
    const ignored = Array.from({ length: 5 }, (_, index) => application({
      id: `ignored-${index}`, companyName: `Ignored ${index}`, followUpDate: "2026-07-31",
    }));
    const active = [
      application({ id: "boundary", companyName: "Thirty days", followUpDate: "2026-08-01" }),
      application({ id: "future", companyName: "Future reminder", followUpDate: "2026-09-01" }),
    ];
    const { rerender } = render(<Dashboard applications={[...ignored, ...active]} />);
    const queue = screen.getByText("Upcoming Follow-ups").parentElement!.parentElement!;
    const dueCount = () => screen.getByText("Follow-ups Due").parentElement!;

    // Filtering must happen before the five-row cap so old reminders cannot hide active ones.
    expect(within(queue).queryByText("Ignored 0")).not.toBeInTheDocument();
    expect(within(queue).getByText("Thirty days")).toBeInTheDocument();
    expect(within(queue).getByText("Future reminder")).toBeInTheDocument();
    expect(within(dueCount()).getByText("1")).toBeInTheDocument();

    rerender(<Dashboard applications={[{ ...ignored[0], followUpDate: "2026-08-31" }, ...ignored.slice(1), ...active]} />);
    expect(within(queue).getByText("Ignored 0")).toBeInTheDocument();
    expect(within(dueCount()).getByText("2")).toBeInTheDocument();
  });

  it("keeps terminal reminders out of both the dashboard queue and due metric", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 31, 12));
    render(<Dashboard applications={[
      application({ id: "response-rejected", companyName: "Response rejected", followUpDate: "2026-08-20", responseStatus: "Rejected", currentStatus: "Applied" }),
      application({ id: "current-rejected", companyName: "Current rejected", followUpDate: "2026-08-20", responseStatus: "Applied", currentStatus: "Rejected" }),
      application({ id: "cancelled", companyName: "Cancelled role", followUpDate: "2026-08-20", responseStatus: "Role Cancelled", currentStatus: "Applied" }),
      application({ id: "interview", companyName: "Active interview", followUpDate: "2026-08-20", responseStatus: "Interview", currentStatus: "Interview" }),
      application({ id: "active", companyName: "Automated reply", followUpDate: "2026-08-20", responseStatus: "Auto-reply received", currentStatus: "Applied" }),
    ]} />);
    const queue = screen.getByText("Upcoming Follow-ups").parentElement!.parentElement!;
    const dueCount = screen.getByText("Follow-ups Due").parentElement!;

    // The summary consumes the same classifier as the full page instead of reconstructing eligibility locally.
    expect(within(queue).queryByText("Response rejected")).not.toBeInTheDocument();
    expect(within(queue).queryByText("Current rejected")).not.toBeInTheDocument();
    expect(within(queue).queryByText("Cancelled role")).not.toBeInTheDocument();
    expect(within(queue).queryByText("Active interview")).not.toBeInTheDocument();
    expect(within(queue).getByText("Automated reply")).toBeInTheDocument();
    expect(within(dueCount).getByText("1")).toBeInTheDocument();
  });

  it("shows the six monitoring metrics without dashboard AI recommendations", () => {
    render(<Dashboard applications={[application({ responseStatus: "Pre-screen call" }), application({ id: "app-2", responseStatus: "Rejected" })]} />);

    // AI coaching belongs exclusively to analytics; the dashboard exposes operational measures.
    expect(screen.getByText("Qualified This Week")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Human Response")).toBeInTheDocument();
    expect(screen.getByText("Active Process")).toBeInTheDocument();
    expect(screen.getByText("Stale 21+ Days")).toBeInTheDocument();
    expect(screen.getByText("Follow-ups Due")).toBeInTheDocument();
    expect(screen.getByText("Offers (90 Days)")).toBeInTheDocument();
    expect(screen.queryByText("Insights & Recommendations")).not.toBeInTheDocument();
  });

  it("renders a donut chart and preserves click-to-filter navigation from its legend", () => {
    navigateMock.mockReset();
    render(<Dashboard applications={[application({ responseStatus: "Interview" }), application({ id: "app-2", responseStatus: "Interview" }), application({ id: "app-3", responseStatus: "No Response" })]} />);
    const graph = screen.getByRole("img", { name: "Application status donut chart, 3 total applications" });
    expect(within(graph).getByTestId("status-pie-chart")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Interview applications: 2, 67%" }));
    expect(navigateMock).toHaveBeenCalledWith("/app/applications?responseStatus=Interview");
  });

  it("groups recent activity, follow-ups, and quick actions in the activity region", () => {
    render(<Dashboard applications={[application({ followUpDate: "2026-08-08" })]} />);
    const region = screen.getByRole("region", { name: "Application activity" });
    expect(within(region).getByText("Recent Activity")).toBeInTheDocument();
    expect(within(region).getByText("Upcoming Follow-ups")).toBeInTheDocument();
    expect(within(region).getByText("Quick Actions")).toBeInTheDocument();
  });

  it("renders monthly applications as a line graph", () => {
    render(<Dashboard applications={[application()]} />);
    const graph = screen.getByRole("img", { name: "Monthly applications line graph" });
    expect(within(graph).getByTestId("monthly-line-chart")).toBeInTheDocument();
    expect(within(graph).getByTestId("monthly-line")).toBeInTheDocument();
  });

  it("changes the visible chart history from the range control", () => {
    render(<Dashboard applications={[
      application({ id: "may", dateApplied: "2026-05-01" }),
      application({ id: "jun", dateApplied: "2026-06-01" }),
      application({ id: "jul", dateApplied: "2026-07-01" }),
      application({ id: "aug", dateApplied: "2026-08-01" }),
    ]} />);

    const chart = screen.getByTestId("monthly-line-chart");
    expect(chart).toHaveAttribute("data-points", "4");
    // Selecting a shorter range immediately updates the data passed to the chart.
    fireEvent.change(screen.getByRole("combobox", { name: "Applications chart range" }), { target: { value: "3" } });
    expect(chart).toHaveAttribute("data-points", "3");
  });

  it("reveals the drag-and-drop import area from the page header", () => {
    render(<Dashboard applications={[]} onImportXLSX={vi.fn()} />);
    expect(screen.queryByTestId("excel-drop-zone")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import Applications" }));
    expect(screen.getByTestId("excel-drop-zone")).toBeInTheDocument();
  });
});
