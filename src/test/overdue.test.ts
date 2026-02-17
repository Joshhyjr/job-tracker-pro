import { describe, expect, it } from "vitest";
import { isApplicationOverdue } from "@/lib/overdue";
import type { CurrentStatus } from "@/lib/types";

type CaseInput = {
  dateApplied: string;
  currentStatus: CurrentStatus;
  followUps?: boolean | string | null;
};

const NOW = new Date("2026-02-17T12:00:00.000Z");

describe("isApplicationOverdue", () => {
  it("returns true for 3 valid overdue cases", () => {
    const validCases: CaseInput[] = [
      { dateApplied: "2026-02-01", currentStatus: "Applied", followUps: true },
      { dateApplied: "2026-02-05", currentStatus: "No Response", followUps: "Yes" },
      { dateApplied: "2026-02-02", currentStatus: "Applied", followUps: " yes " },
    ];

    validCases.forEach((input) => {
      expect(isApplicationOverdue(input, NOW)).toBe(true);
    });
  });

  it("returns false for 3 invalid/non-overdue cases", () => {
    const invalidCases: CaseInput[] = [
      { dateApplied: "", currentStatus: "Applied", followUps: "Yes" }, // missing date
      { dateApplied: "not-a-date", currentStatus: "No Response", followUps: "Yes" }, // invalid date
      { dateApplied: "2026-02-01", currentStatus: "Applied", followUps: "No" }, // follow-up must be "Yes" if present
    ];

    invalidCases.forEach((input) => {
      expect(isApplicationOverdue(input, NOW)).toBe(false);
    });
  });
});
