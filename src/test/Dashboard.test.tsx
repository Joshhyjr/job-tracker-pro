import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/Dashboard";
import type { JobApplication } from "@/lib/types";

const {
  getHostedAiAccessTokenMock,
  getLastImportMetadataMock,
  getPreferredResponseStatusOrderMock,
} = vi.hoisted(() => ({
  getHostedAiAccessTokenMock: vi.fn(),
  getLastImportMetadataMock: vi.fn(),
  getPreferredResponseStatusOrderMock: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("recharts", () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Cell: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/aiInsights", () => ({
  buildAiInsightSummary: vi.fn(),
  generateAiInsightsWithFallback: vi.fn(),
  getConfiguredOllamaModel: vi.fn(() => "llama3"),
  getHostedAiAccessToken: getHostedAiAccessTokenMock,
  setHostedAiAccessToken: vi.fn(),
}));

vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage");
  return {
    ...actual,
    getLastImportMetadata: getLastImportMetadataMock,
    getPreferredResponseStatusOrder: getPreferredResponseStatusOrderMock,
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
    dateApplied: overrides.dateApplied ?? "2026-07-01",
    notes: overrides.notes ?? "",
    followUpDate: overrides.followUpDate ?? "",
    activityLog: overrides.activityLog ?? [],
  };
}

describe("Dashboard", () => {
  beforeEach(() => {
    getHostedAiAccessTokenMock.mockReturnValue("");
    getPreferredResponseStatusOrderMock.mockReturnValue([]);
    getLastImportMetadataMock.mockReset();
  });

  it("refreshes import metadata when the applications change without changing row count", () => {
    let importMetadata = {
      fileName: "week-1.xlsx",
      importedAt: "2026-07-01T12:00:00.000Z",
      rowCount: 1,
      warningCount: 0,
    };
    getLastImportMetadataMock.mockImplementation(() => importMetadata);

    const { rerender } = render(
      <Dashboard applications={[application({ id: "app-1", companyName: "Acme" })]} />,
    );

    expect(screen.getByText("Using XLSX import: week-1.xlsx")).toBeInTheDocument();

    importMetadata = {
      fileName: "week-2.xlsx",
      importedAt: "2026-07-02T12:00:00.000Z",
      rowCount: 1,
      warningCount: 0,
    };

    rerender(
      <Dashboard applications={[application({ id: "app-2", companyName: "Beacon" })]} />,
    );

    // Imports can replace the dataset without changing the total row count, so the dashboard must re-read the workbook metadata on any dataset refresh.
    expect(screen.getByText("Using XLSX import: week-2.xlsx")).toBeInTheDocument();
  });

  it("counts pre-screen calls toward the interview-rate insight", () => {
    render(
      <Dashboard
        applications={[
          application({ id: "app-1", responseStatus: "Pre-screen call" }),
          application({ id: "app-2", responseStatus: "Interview" }),
          application({ id: "app-3", responseStatus: "Applied" }),
        ]}
      />,
    );

    // Early positive signals should count the same way in the dashboard as they do in AI summaries.
    expect(screen.getByText("Your interview rate: 67%")).toBeInTheDocument();
  });
});
