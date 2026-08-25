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

  it("shows qualified volume and a mature-cohort funnel without a prediction score", () => {
    const applications: JobApplication[] = [
      { ...app, id: "june-interview", dateApplied: "2026-06-01", currentStatus: "Interview", responseStatus: "Interview", roleFit: "strong", resumeTailored: true },
      { ...app, id: "june-no-response", dateApplied: "2026-06-10", currentStatus: "No Response", responseStatus: "No Response", roleFit: "moderate", resumeTailored: true },
      { ...app, id: "july-rejected", dateApplied: "2026-07-01", currentStatus: "Rejected", responseStatus: "Rejected", roleFit: "stretch", resumeTailored: false },
    ];
    render(<Analytics applications={applications} />);

    expect(screen.getByRole("region", { name: "Search health" })).toBeInTheDocument();
    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
    const qualifiedCard = screen.getByText("Qualified Applications by Week").closest(".app-panel");
    expect(qualifiedCard).not.toBeNull();
    // The activity trend always provides a comparable thirteen-week window.
    const points = JSON.parse(within(qualifiedCard as HTMLElement).getByTestId("analytics-line-chart").getAttribute("data-points") || "[]");
    expect(points).toHaveLength(13);
    const funnelCard = screen.getByText("Mature Cohort Funnel").closest(".app-panel");
    expect(funnelCard).not.toBeNull();
    expect(within(funnelCard as HTMLElement).getByText("Submitted")).toBeInTheDocument();
    expect(within(funnelCard as HTMLElement).getByText("3/3")).toBeInTheDocument();
    const analyticsRegion = screen.getByRole("region", { name: "Job search analytics" });
    // The visualization row contains activity, outcomes, and source-backed role context.
    expect(analyticsRegion.children).toHaveLength(3);
    const titlesCard = screen.getByText("Job Titles Applied to Most").closest(".app-panel");
    expect(titlesCard).not.toBeNull();
    expect(within(titlesCard as HTMLElement).getByText("Data Analyst")).toBeInTheDocument();
    expect(within(titlesCard as HTMLElement).getByLabelText("Data Analyst: 3 applications")).toBeInTheDocument();
  });
});
