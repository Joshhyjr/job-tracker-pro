import { describe, expect, it } from "vitest";
import { planApplicationImport } from "@/lib/applicationMerge";
import type { JobApplication } from "@/lib/types";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "application-1",
    jobTitle: "Platform Engineer",
    companyName: "IBM",
    location: "Remote",
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-08-01",
    notes: "Owner note",
    followUpDate: "",
    activityLog: [],
    ...overrides,
  };
}

describe("planApplicationImport", () => {
  it("appends new jobs while preserving every current job", () => {
    const ibm = application();
    const apple = application({ id: "application-2", companyName: "Apple", dateApplied: "2026-08-05" });

    const plan = planApplicationImport([ibm], [apple]);

    // Incremental import keeps IBM in place and appends only the new Apple application.
    expect(plan.additions).toEqual([apple]);
    expect(plan.updates).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.mergedApplications).toEqual([ibm, apple]);
  });

  it("skips normalized company-role-date duplicates without overwriting owner data", () => {
    const existing = application({ companyName: "IBM, Inc.", jobTitle: "Platform  Engineer", notes: "Keep this note" });
    const duplicate = application({ id: "generated-import-id", companyName: "ibm inc", jobTitle: "platform engineer", notes: "Spreadsheet note" });

    const plan = planApplicationImport([existing], [duplicate]);

    // Composite matches are intentionally skip-only because they are less authoritative than a stable ID.
    expect(plan.additions).toEqual([]);
    expect(plan.updates).toEqual([]);
    expect(plan.skipped).toMatchObject([{ match: "company-role-date" }]);
    expect(plan.mergedApplications).toEqual([existing]);
  });

  it("updates an explicit stable ID while preserving timestamps and activity history", () => {
    const activityLog = [{ id: "log-1", date: "2026-08-02T12:00:00.000Z", type: "note" as const, message: "Called recruiter" }];
    const existing = application({ id: "stable-1", createdAt: "2026-08-01T10:00:00.000Z", activityLog, responseStatus: "Applied" });
    const imported = application({ id: "stable-1", responseStatus: "Interview", currentStatus: "Interview", notes: "Updated in workbook", activityLog: [] });

    const plan = planApplicationImport([existing], [imported]);

    // Stable identity permits field updates but never lets a workbook erase the owner's audit history.
    expect(plan.updates).toMatchObject([{
      id: "stable-1",
      responseStatus: "Interview",
      notes: "Updated in workbook",
      createdAt: existing.createdAt,
      activityLog,
    }]);
    expect(plan.additions).toEqual([]);
    expect(plan.mergedApplications).toEqual(plan.updates);
  });

  it("preserves fields omitted from a partial stable-ID workbook", () => {
    const existing = application({
      id: "stable-1",
      responseStatus: "Applied",
      notes: "Keep owner note",
      followUpDate: "2026-08-20",
      jobLink: "https://jobs.example/platform",
      city: "Halifax",
      country: "Canada",
      countryCode: "CA",
      customFields: { Portfolio: "Keep portfolio", Referral: "Keep referral" },
    });
    const imported = application({
      id: "stable-1",
      responseStatus: "Interview",
      currentStatus: "Interview",
      notes: "",
      followUpDate: "",
      customFields: { Portfolio: "Updated portfolio" },
    });

    const plan = planApplicationImport([existing], [imported], {
      applicationFields: ["jobTitle", "companyName", "responseStatus"],
      customFieldHeaders: ["Portfolio"],
    });

    // Only workbook columns participate in the update; omitted owner data remains intact.
    expect(plan.updates[0]).toMatchObject({
      responseStatus: "Interview",
      currentStatus: "Interview",
      notes: "Keep owner note",
      followUpDate: "2026-08-20",
      jobLink: "https://jobs.example/platform",
      city: "Halifax",
      country: "Canada",
      countryCode: "CA",
      customFields: { Portfolio: "Updated portfolio", Referral: "Keep referral" },
    });
  });

  it("clears present blank fields without clearing omitted fields", () => {
    const existing = application({
      id: "stable-1",
      notes: "Clear this note",
      followUpDate: "2026-08-20",
      jobLink: "https://jobs.example/clear-this",
      customFields: { Portfolio: "Clear this", Referral: "Keep this" },
    });
    const imported = application({ id: "stable-1", notes: "", followUpDate: "", customFields: undefined });

    const plan = planApplicationImport([existing], [imported], {
      applicationFields: ["jobTitle", "companyName", "notes", "jobLink"],
      customFieldHeaders: ["Portfolio"],
    });

    // Blank cells still express intentional clearing, but only for columns included in the workbook.
    expect(plan.updates[0]).toMatchObject({ notes: "", followUpDate: "2026-08-20", customFields: { Referral: "Keep this" } });
    expect(plan.updates[0]).not.toHaveProperty("jobLink");
  });

  it("uses a normalized job link carefully when an application date is missing", () => {
    const existing = application({ dateApplied: "", jobLink: "https://jobs.example/role?utm_source=email", location: "" });
    const samePosting = application({ id: "generated-2", dateApplied: "", jobLink: "https://jobs.example/role", location: "" });
    const differentPosting = application({ id: "generated-3", dateApplied: "", jobLink: "https://jobs.example/other-role", location: "" });

    const plan = planApplicationImport([existing], [samePosting, differentPosting]);

    // Tracking parameters do not create a new posting, while a genuinely different URL remains additive.
    expect(plan.skipped).toMatchObject([{ match: "company-role-link" }]);
    expect(plan.additions).toEqual([differentPosting]);
    expect(plan.mergedApplications).toEqual([existing, differentPosting]);
  });

  it("deduplicates repeated rows within the imported workbook", () => {
    const first = application({ id: "generated-1", companyName: "Apple" });
    const repeated = application({ id: "generated-2", companyName: "APPLE" });

    const plan = planApplicationImport([], [first, repeated]);

    // The working identity index includes planned additions so the same workbook cannot add a duplicate twice.
    expect(plan.additions).toEqual([first]);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.mergedApplications).toEqual([first]);
  });

  it("counts repeated stable-ID rows as only one update", () => {
    const existing = application({ id: "stable-1" });
    const firstUpdate = application({ id: "stable-1", responseStatus: "Interview", currentStatus: "Interview" });
    const repeatedUpdate = application({ id: "stable-1", responseStatus: "Offer", currentStatus: "Offer" });

    const plan = planApplicationImport([existing], [firstUpdate, repeatedUpdate]);

    // A malformed workbook cannot inflate the update count or write the same stable record twice.
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].responseStatus).toBe("Interview");
    expect(plan.skipped).toHaveLength(1);
  });
});
