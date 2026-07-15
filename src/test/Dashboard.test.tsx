import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/Dashboard";
import type { JobApplication } from "@/lib/types";
import type { User } from "firebase/auth";

const {
  buildAiInsightSummaryMock,
  generateAiInsightsWithFallbackMock,
  getLastImportMetadataMock,
  getPreferredResponseStatusOrderMock,
  navigateMock,
} = vi.hoisted(() => ({
  buildAiInsightSummaryMock: vi.fn(),
  generateAiInsightsWithFallbackMock: vi.fn(),
  getLastImportMetadataMock: vi.fn(),
  getPreferredResponseStatusOrderMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("recharts", () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/aiInsights", () => ({
  buildAiInsightSummary: buildAiInsightSummaryMock,
  generateAiInsightsWithFallback: generateAiInsightsWithFallbackMock,
  getConfiguredOllamaModel: vi.fn(() => "llama3"),
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
    buildAiInsightSummaryMock.mockReset();
    generateAiInsightsWithFallbackMock.mockReset();
    getPreferredResponseStatusOrderMock.mockReturnValue([]);
    getLastImportMetadataMock.mockReset();
    navigateMock.mockReset();
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

  it("shows status counts as horizontal bars and preserves click-to-filter navigation", () => {
    render(
      <Dashboard
        applications={[
          application({ id: "app-1", responseStatus: "Interview" }),
          application({ id: "app-2", responseStatus: "Interview" }),
          application({ id: "app-3", responseStatus: "No Response" }),
          application({ id: "app-4", responseStatus: "Offer" }),
        ]}
      />,
    );

    // Direct labels expose the exact count and share without relying on color or a hover tooltip.
    const interviewBar = screen.getByRole("button", { name: "View Interview applications: 2, 50%" });
    expect(screen.getByRole("button", { name: "View No Response applications: 1, 25%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Offer applications: 1, 25%" })).toBeInTheDocument();
    expect(screen.getByText("Share of 4 applications · Select a bar to filter")).toBeInTheDocument();

    fireEvent.click(interviewBar);

    expect(navigateMock).toHaveBeenCalledWith("/app/applications?responseStatus=Interview");
  });

  it("groups recent applications below the monthly chart", () => {
    render(<Dashboard applications={[application()]} />);

    // The shared desktop column removes the empty area beneath the shorter monthly chart.
    const activityColumn = screen.getByRole("region", { name: "Application activity" });
    expect(within(activityColumn).getByRole("heading", { name: "Monthly Applications" })).toBeInTheDocument();
    expect(within(activityColumn).getByRole("heading", { name: "Recent Applications" })).toBeInTheDocument();
  });

  it("uses the signed-in Firebase ID token without rendering a manual token field", async () => {
    const summary = { totalApplications: 1 };
    const getIdToken = vi.fn().mockResolvedValue("firebase-id-token");
    buildAiInsightSummaryMock.mockReturnValue(summary);
    generateAiInsightsWithFallbackMock.mockResolvedValue({
      summary: "Authenticated insight",
      strengths: [],
      improvementAreas: [],
      recommendedNextActions: [],
    });
    const user = { email: "joshuakivaria@gmail.com", getIdToken } as unknown as User;

    render(<Dashboard applications={[application()]} user={user} />);

    // Google authentication replaces the old operator-entered bearer secret in the owner dashboard.
    expect(screen.queryByLabelText("Hosted AI access token")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate AI insights" }));

    await waitFor(() => {
      expect(generateAiInsightsWithFallbackMock).toHaveBeenCalledWith(summary, "firebase-id-token");
    });
    expect(getIdToken).toHaveBeenCalledOnce();
    expect(screen.getByText("Authenticated insight")).toBeInTheDocument();
  });
});
