import { describe, expect, it } from "vitest";
import { buildJobSearchMetrics, hasReachedInterview, isIntentionallyDueForFollowUp, isQualifiedApplication } from "@/lib/jobSearchMetrics";
import type { JobApplication } from "@/lib/types";

const NOW = new Date("2026-08-25T12:00:00");

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    jobTitle: overrides.jobTitle ?? "Data Analyst",
    companyName: overrides.companyName ?? "Acme",
    location: overrides.location ?? "Halifax, Canada",
    currentStatus: overrides.currentStatus ?? "Applied",
    responseStatus: overrides.responseStatus ?? "Applied",
    followUps: overrides.followUps ?? false,
    dateApplied: overrides.dateApplied ?? "2026-08-04",
    notes: overrides.notes ?? "",
    followUpDate: overrides.followUpDate ?? "",
    roleFit: overrides.roleFit,
    resumeTailored: overrides.resumeTailored,
    activityLog: overrides.activityLog ?? [],
  };
}

describe("jobSearchMetrics", () => {
  it("separates recent acknowledgements from stale applications and excludes future dates", () => {
    const metrics = buildJobSearchMetrics([
      application({ id: "recent", dateApplied: "2026-08-05", responseStatus: "Auto-reply received" }),
      application({ id: "stale", dateApplied: "2026-08-04", responseStatus: "Auto-reply received" }),
      application({ id: "future", dateApplied: "2026-08-26", responseStatus: "Applied" }),
    ], NOW);

    // Exactly 21 days is mature/stale; a future application never enters a current-period metric.
    expect(metrics.awaitingHumanResponse).toBe(1);
    expect(metrics.stale).toBe(1);
    expect(metrics.invalidOrFutureDateCount).toBe(1);
  });

  it("uses structured history so a later rejection does not erase an interview", () => {
    const rejectedAfterInterview = application({
      responseStatus: "Rejected",
      currentStatus: "Rejected",
      activityLog: [{ id: "event-1", date: "2026-08-10T12:00:00Z", type: "status_change", message: "Interview to Rejected", fromStatus: "Interview", toStatus: "Rejected" }],
    });
    const preScreenOnly = application({ id: "screen", responseStatus: "Pre-screen call", currentStatus: "Pre-screen call" });

    expect(hasReachedInterview(rejectedAfterInterview)).toBe(true);
    expect(hasReachedInterview(preScreenOnly)).toBe(false);
    const metrics = buildJobSearchMetrics([rejectedAfterInterview, preScreenOnly], NOW);
    expect(metrics.positiveProgression.count).toBe(2);
    expect(metrics.interviews.count).toBe(1);
  });

  it("includes only applications aged 21 through 90 days in conversion denominators", () => {
    const metrics = buildJobSearchMetrics([
      application({ id: "day-20", dateApplied: "2026-08-05", responseStatus: "Interview" }),
      application({ id: "day-21", dateApplied: "2026-08-04", responseStatus: "Interview" }),
      application({ id: "day-90", dateApplied: "2026-05-27", responseStatus: "Offer", currentStatus: "Offer" }),
      application({ id: "day-91", dateApplied: "2026-05-26", responseStatus: "Interview" }),
    ], NOW);

    expect(metrics.cohort).toEqual({ start: "2026-05-27", end: "2026-08-04", size: 2 });
    expect(metrics.interviews).toMatchObject({ count: 2, denominator: 2, rate: 100, signal: "low-signal" });
    // An offer snapshot implies prior interview progress even without imported event history.
    expect(metrics.offers.count).toBe(1);
  });

  it("defines qualified volume from explicit fit and tailoring inputs", () => {
    expect(isQualifiedApplication(application({ roleFit: "strong", resumeTailored: true }))).toBe(true);
    expect(isQualifiedApplication(application({ roleFit: "moderate", resumeTailored: true }))).toBe(true);
    expect(isQualifiedApplication(application({ roleFit: "stretch", resumeTailored: true }))).toBe(false);
    expect(isQualifiedApplication(application({ roleFit: "strong", resumeTailored: false }))).toBe(false);

    const metrics = buildJobSearchMetrics([
      application({ id: "qualified", dateApplied: "2026-08-24", roleFit: "strong", resumeTailored: true }),
      application({ id: "volume-only", dateApplied: "2026-08-25", roleFit: "stretch", resumeTailored: true }),
    ], NOW);
    expect(metrics.qualifiedThisWeek).toBe(1);
    expect(metrics.weeklyTrend.at(-1)).toMatchObject({ total: 2, qualified: 1 });
  });

  it("counts only confirmed incomplete follow-up dates that are due", () => {
    expect(isIntentionallyDueForFollowUp(application({ followUpDate: "" }), NOW)).toBe(false);
    expect(isIntentionallyDueForFollowUp(application({ followUpDate: "2026-08-25" }), NOW)).toBe(true);
    expect(isIntentionallyDueForFollowUp(application({ followUpDate: "2026-08-24", followUps: true }), NOW)).toBe(false);
    expect(isIntentionallyDueForFollowUp(application({ followUpDate: "2026-08-24", responseStatus: "Rejected", currentStatus: "Rejected" }), NOW)).toBe(false);
  });

  it("honors current-status-only workbook rows when response status falls back to Applied", () => {
    const metrics = buildJobSearchMetrics([
      application({ id: "assessment", currentStatus: "Assessment", responseStatus: "Applied" }),
      application({ id: "rejected", currentStatus: "Rejected", responseStatus: "Applied", followUpDate: "2026-08-20" }),
      application({ id: "withdrawn", currentStatus: "Withdrawn", responseStatus: "Applied", followUpDate: "2026-08-20" }),
    ], NOW);

    // Current Status is authoritative when an imported workbook has no Response Status column.
    expect(metrics.activeProcess).toBe(1);
    expect(metrics.awaitingHumanResponse).toBe(0);
    expect(metrics.stale).toBe(0);
    expect(metrics.followUpsDue).toBe(0);
    expect(metrics.rejections).toBe(1);
    expect(metrics.unclassifiedStatusCount).toBe(0);
  });
});
