import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("shows the six monitoring metrics without dashboard AI recommendations", () => {
    render(<Dashboard applications={[application({ responseStatus: "Pre-screen call" }), application({ id: "app-2", responseStatus: "Rejected" })]} />);

    // AI coaching belongs exclusively to the analytics route after the redesign.
    expect(screen.getByText("Total Applications")).toBeInTheDocument();
    expect(screen.getByText("Interviews")).toBeInTheDocument();
    expect(screen.getByText("Rejections")).toBeInTheDocument();
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
