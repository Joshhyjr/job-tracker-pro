import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAiInsightSummary, generateAiInsightsWithFallback, generateHostedAiInsights, parseLocalAiInsightsContent } from "@/lib/aiInsights";
import type { JobApplication } from "@/lib/types";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: overrides.id ?? Math.random().toString(36),
    jobTitle: overrides.jobTitle ?? "Frontend Engineer",
    companyName: overrides.companyName ?? "Acme",
    location: overrides.location ?? "Remote",
    currentStatus: overrides.currentStatus ?? "Applied",
    responseStatus: overrides.responseStatus ?? "Applied",
    followUps: overrides.followUps ?? false,
    dateApplied: overrides.dateApplied ?? "2026-05-25",
    notes: overrides.notes ?? "Private note should not appear in the AI summary.",
    followUpDate: overrides.followUpDate ?? "",
    recruiterContactName: overrides.recruiterContactName ?? "Private recruiter",
    salary: overrides.salary,
    coverLetterIncluded: overrides.coverLetterIncluded,
    interviewDate: overrides.interviewDate,
    tags: overrides.tags,
    latitude: overrides.latitude,
    longitude: overrides.longitude,
    customFields: overrides.customFields ?? { Secret: "Do not send" },
    activityLog: overrides.activityLog ?? [],
  };
}

describe("buildAiInsightSummary", () => {
  const now = new Date("2026-06-02T12:00:00Z");

  it("builds an empty summary without private details", () => {
    const summary = buildAiInsightSummary([], now);

    expect(summary.totalApplications).toBe(0);
    expect(summary.dataSource.type).toBe("browser-records");
    expect(summary.improvementSignals).toContain("No applications are tracked yet, so recommendations should focus on getting started.");
    expect(JSON.stringify(summary)).not.toContain("Private");
  });

  it("adds XLSX metadata and spreadsheet coverage without private cell values", () => {
    const summary = buildAiInsightSummary([
      application({
        salary: "$90k",
        coverLetterIncluded: true,
        interviewDate: "2026-06-05",
        tags: "remote, frontend",
        latitude: 44.65,
        longitude: -63.57,
      }),
    ], now, {
      fileName: "job-search.xlsx",
      importedAt: "2026-06-02T12:00:00.000Z",
      rowCount: 1,
      warningCount: 0,
    });

    expect(summary.dataSource).toMatchObject({ type: "xlsx-import", fileName: "job-search.xlsx", rowCount: 1 });
    expect(summary.spreadsheetCoverage).toMatchObject({
      withSalary: 1,
      withRecruiter: 1,
      withCoverLetter: 1,
      withInterviewDate: 1,
      withTags: 1,
      withCustomFields: 1,
      withLocation: 1,
      withCoordinates: 1,
    });
    expect(summary.spreadsheetCoverage.customFieldHeaders).toEqual(["Secret"]);
    expect(summary.improvementSignals).toContain("Recommendations should account for the latest imported workbook: job-search.xlsx.");
    expect(JSON.stringify(summary)).not.toContain("Do not send");
  });

  it("captures low-data momentum and improvement signals", () => {
    const summary = buildAiInsightSummary([
      application({ responseStatus: "No Response", dateApplied: "2026-05-10", followUps: true }),
      application({ responseStatus: "Applied", dateApplied: "2026-06-01", companyName: "Beta", jobTitle: "Support Engineer" }),
    ], now);

    expect(summary.totalApplications).toBe(2);
    expect(summary.appliedThisWeek).toBe(1);
    expect(summary.staleNoResponseCount).toBe(1);
    expect(summary.missingFollowUpDateCount).toBe(1);
    expect(summary.improvementSignals).toEqual(expect.arrayContaining([
      "1 applications have had no response after 14+ days.",
      "1 follow-up-enabled applications are missing a follow-up date.",
    ]));
  });

  it("summarizes mixed statuses and overdue follow-ups", () => {
    const summary = buildAiInsightSummary([
      application({ responseStatus: "Interview", dateApplied: "2026-05-28", followUps: true, followUpDate: "2026-06-01" }),
      application({ currentStatus: "No Response", responseStatus: "No Response", dateApplied: "2026-05-20", companyName: "Beta", followUps: true }),
      application({ responseStatus: "Offer", dateApplied: "2026-06-02", companyName: "Beta", location: "Toronto" }),
    ], now);

    expect(summary.interviewCount).toBe(2);
    expect(summary.interviewRate).toBe(67);
    expect(summary.offerCount).toBe(1);
    expect(summary.overdueFollowUpCount).toBe(1);
    expect(summary.topCompanies[0]).toEqual({ name: "Beta", count: 2 });
    expect(summary.statusBreakdown).toEqual(expect.arrayContaining([{ status: "Offer", count: 1 }]));
  });

  it("recognizes high-response datasets without low conversion warnings", () => {
    const summary = buildAiInsightSummary([
      application({ responseStatus: "Pre-screen call", dateApplied: "2026-06-01" }),
      application({ responseStatus: "Assessment", dateApplied: "2026-05-25" }),
      application({ responseStatus: "Offer", dateApplied: "2026-05-24" }),
      application({ responseStatus: "Applied", dateApplied: "2026-05-23" }),
    ], now);

    expect(summary.interviewRate).toBe(75);
    expect(summary.offerRate).toBe(25);
    expect(summary.improvementSignals.some((signal) => signal.includes("Interview conversion is below"))).toBe(false);
  });
});

describe("parseLocalAiInsightsContent", () => {
  it("flattens object-shaped model summaries into readable text", () => {
    const insights = parseLocalAiInsightsContent(JSON.stringify({
      summary: { overview: "Your search has volume but needs better follow-up discipline." },
      strengths: ["Strong application volume"],
      improvementAreas: ["Improve interview conversion"],
      recommendedNextActions: ["Follow up on stale applications"],
    }));

    expect(insights.summary).toBe("Your search has volume but needs better follow-up discipline.");
    expect(insights.summary).not.toBe("[object Object]");
  });
});

describe("hosted AI insights", () => {
  const summary = buildAiInsightSummary([application()], new Date("2026-06-02T12:00:00Z"));
  const hostedInsights = {
    summary: "Hosted summary",
    strengths: ["Consistent applications"],
    improvementAreas: ["Follow up sooner"],
    recommendedNextActions: ["Schedule a follow-up"],
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends only the privacy-filtered summary to the hosted endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(hostedInsights), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateHostedAiInsights(summary, "firebase-id-token")).resolves.toEqual(hostedInsights);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(request.headers.Authorization).toBe("Bearer firebase-id-token");
    expect(body).toEqual({ summary });
    expect(JSON.stringify(body)).not.toContain("Private note");
    expect(JSON.stringify(body)).not.toContain("Private recruiter");
    vi.unstubAllGlobals();
  });

  it("uses Ollama when hosted insights fail", async () => {
    const hostedGenerator = vi.fn().mockRejectedValue(new Error("Hosted unavailable"));
    const localGenerator = vi.fn().mockResolvedValue(hostedInsights);

    await expect(generateAiInsightsWithFallback(summary, "firebase-id-token", hostedGenerator, localGenerator)).resolves.toEqual(hostedInsights);
    expect(hostedGenerator).toHaveBeenCalledWith(summary, "firebase-id-token");
    expect(localGenerator).toHaveBeenCalledWith(summary);
  });

  it("requires a Google session before calling either hosted or local AI", async () => {
    const hostedGenerator = vi.fn();
    const localGenerator = vi.fn();

    await expect(generateAiInsightsWithFallback(summary, "", hostedGenerator, localGenerator)).rejects.toThrow(
      "Sign in with the approved Google account",
    );
    expect(hostedGenerator).not.toHaveBeenCalled();
    expect(localGenerator).not.toHaveBeenCalled();
  });

  it("surfaces hosted authentication errors without an unrelated Ollama fallback", async () => {
    const hostedGenerator = vi.fn().mockRejectedValue(new Error("Google authentication required."));
    const localGenerator = vi.fn();

    await expect(generateAiInsightsWithFallback(summary, "firebase-id-token", hostedGenerator, localGenerator)).rejects.toThrow(
      "Google authentication required.",
    );
    expect(localGenerator).not.toHaveBeenCalled();
  });

  it("reports both failures when hosted and local insights fail", async () => {
    const hostedGenerator = vi.fn().mockRejectedValue(new Error("Hosted unavailable"));
    const localGenerator = vi.fn().mockRejectedValue(new Error("Ollama unavailable"));

    await expect(generateAiInsightsWithFallback(summary, "firebase-id-token", hostedGenerator, localGenerator)).rejects.toThrow(
      "Gemini failed: Hosted unavailable Ollama fallback failed: Ollama unavailable",
    );
  });
});
