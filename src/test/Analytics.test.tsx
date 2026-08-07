import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import Analytics from "@/pages/Analytics";
import type { JobApplication } from "@/lib/types";

const { buildSummaryMock, generateMock, metadataMock } = vi.hoisted(() => ({ buildSummaryMock: vi.fn(), generateMock: vi.fn(), metadataMock: vi.fn() }));
vi.mock("recharts", () => ({ Line: () => null, LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => <div data-testid="analytics-line-chart" data-points={JSON.stringify(data)}>{children}</div>, CartesianGrid: () => null, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Tooltip: () => null, XAxis: () => null, YAxis: () => null }));
vi.mock("@/lib/aiInsights", () => ({ buildAiInsightSummary: buildSummaryMock, generateAiInsightsWithFallback: generateMock, getConfiguredOllamaModel: () => "llama3" }));
vi.mock("@/lib/storage", async () => ({ ...(await vi.importActual<typeof import("@/lib/storage")>("@/lib/storage")), getLastImportMetadata: metadataMock }));

const app: JobApplication = { id: "1", jobTitle: "Data Analyst", companyName: "Acme", location: "Halifax, Canada", country: "Canada", currentStatus: "Interview", responseStatus: "Pre-screen call", followUps: true, dateApplied: "2026-08-01", notes: "", followUpDate: "", activityLog: [] };

describe("Analytics", () => {
  beforeEach(() => { buildSummaryMock.mockReset(); generateMock.mockReset(); metadataMock.mockReset(); });

  it("uses the Firebase ID token for AI guidance and labels it as guidance", async () => {
    buildSummaryMock.mockReturnValue({ totalApplications: 1 });
    generateMock.mockResolvedValue({ summary: "Keep tailoring each application.", strengths: [], improvementAreas: [], recommendedNextActions: [] });
    const getIdToken = vi.fn().mockResolvedValue("firebase-token");
    const user = { email: "joshuakivaria@gmail.com", getIdToken } as unknown as User;
    render(<Analytics applications={[app]} user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate AI guidance" }));
    await waitFor(() => expect(generateMock).toHaveBeenCalledWith({ totalApplications: 1 }, "firebase-token"));
    expect(screen.getByText("Guidance, not a guaranteed prediction")).toBeInTheDocument();
  });

  it("refreshes workbook source context when same-sized data changes", () => {
    let metadata = { fileName: "week-1.xlsx", importedAt: "2026-08-01T00:00:00Z", rowCount: 1, warningCount: 0 };
    metadataMock.mockImplementation(() => metadata);
    const { rerender } = render(<Analytics applications={[app]} />);
    expect(screen.getByText(/Using XLSX import: week-1.xlsx/)).toBeInTheDocument();
    metadata = { ...metadata, fileName: "week-2.xlsx" };
    rerender(<Analytics applications={[{ ...app, id: "2" }]} />);
    expect(screen.getByText(/Using XLSX import: week-2.xlsx/)).toBeInTheDocument();
  });

  it("replaces the location chart with monthly response rates", () => {
    const applications = [
      { ...app, id: "may-response", dateApplied: "2026-05-01", responseStatus: "Pre-screen call" },
      { ...app, id: "may-no-response", dateApplied: "2026-05-10", responseStatus: "No Response" },
      { ...app, id: "june-response", dateApplied: "2026-06-01", responseStatus: "Rejected" },
    ];
    render(<Analytics applications={applications} />);

    const responseCard = screen.getByText("Response Rate Over Time").closest(".app-panel");
    expect(responseCard).not.toBeNull();
    // The trend uses the same meaningful-response rule as the summary KPI.
    const points = JSON.parse(within(responseCard as HTMLElement).getByTestId("analytics-line-chart").getAttribute("data-points") || "[]");
    expect(points).toEqual([
      { month: "May 2026", responseRate: 50 },
      { month: "Jun 2026", responseRate: 100 },
    ]);
    expect(screen.queryByText("Applications by Location")).not.toBeInTheDocument();
    // The chart and insight cards carry these measures without a duplicate summary row beneath them.
    expect(screen.queryByRole("region", { name: "Conversion metrics" })).not.toBeInTheDocument();
    const analyticsRegion = screen.getByRole("region", { name: "Job search analytics" });
    // The visualization row now contains the two existing trends and one source-backed job-title ranking card.
    expect(analyticsRegion.children).toHaveLength(3);
    const titlesCard = screen.getByText("Job titles applied to most").closest(".app-panel");
    expect(titlesCard).not.toBeNull();
    expect(within(titlesCard as HTMLElement).getByText("Data Analyst")).toBeInTheDocument();
    expect(within(titlesCard as HTMLElement).getByText("3 applications")).toBeInTheDocument();
  });
});
