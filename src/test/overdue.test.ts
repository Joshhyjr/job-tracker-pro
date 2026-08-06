import { describe, expect, it } from "vitest";
import { isApplicationOverdue } from "@/lib/overdue";
import type { CurrentStatus } from "@/lib/types";

type CaseInput = {
  dateApplied: string;
  currentStatus: CurrentStatus;
  followUps?: boolean | string | null;
  followUpDate?: string | null;
};

const NOW = new Date("2026-02-17T12:00:00.000Z");

describe("isApplicationOverdue", () => {
  it("returns true for 3 valid overdue cases", () => {
    const validCases: CaseInput[] = [
      { dateApplied: "2026-02-01", currentStatus: "Applied", followUps: false },
      { dateApplied: "2026-02-05", currentStatus: "No Response", followUps: "No" },
      { dateApplied: "2026-02-02", currentStatus: "Applied", followUps: null },
    ];

    validCases.forEach((input) => {
      expect(isApplicationOverdue(input, NOW)).toBe(true);
    });
  });

  it("returns false for 3 invalid/non-overdue cases", () => {
    const invalidCases: CaseInput[] = [
      { dateApplied: "", currentStatus: "Applied", followUps: false }, // missing date
      { dateApplied: "not-a-date", currentStatus: "No Response", followUps: "No" }, // invalid date
      { dateApplied: "2026-02-01", currentStatus: "Applied", followUps: " yes " }, // already followed up
    ];

    invalidCases.forEach((input) => {
      expect(isApplicationOverdue(input, NOW)).toBe(false);
    });
  });

  it("uses a valid follow-up date instead of the seven-day fallback", () => {
    // A scheduled date is the user's explicit plan, so it must take precedence over application age.
    expect(isApplicationOverdue({
      dateApplied: "2026-02-01",
      currentStatus: "Applied",
      followUps: false,
      followUpDate: "2026-02-20",
    }, NOW)).toBe(false);

    expect(isApplicationOverdue({
      dateApplied: "2026-02-15",
      currentStatus: "No Response",
      // A completed earlier follow-up does not suppress a newly scheduled one.
      followUps: true,
      followUpDate: "2026-02-17",
    }, NOW)).toBe(true);
  });

  it("falls back to application age when the follow-up date is invalid", () => {
    // Legacy and malformed rows should retain the existing seven-day behavior instead of disappearing.
    expect(isApplicationOverdue({
      dateApplied: "2026-02-01",
      currentStatus: "Applied",
      followUps: false,
      followUpDate: "not-a-date",
    }, NOW)).toBe(true);
  });
});
