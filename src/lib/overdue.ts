import { isAfter, isValid, parseISO, subDays } from "date-fns";
import type { CurrentStatus, JobApplication } from "@/lib/types";

type OverdueCandidate = Pick<JobApplication, "dateApplied" | "currentStatus"> & {
  followUps?: boolean | string | null;
  followUpDate?: string | null;
};

const ELIGIBLE_STATUSES = new Set<CurrentStatus>(["Applied", "No Response"]);
const INELIGIBLE_STATUSES = new Set<CurrentStatus>(["Rejected", "Withdrawn", "Offer", "Pre-screen call", "Interview"]);

function hasCompletedFollowUp(value: OverdueCandidate["followUps"]): boolean {
  if (typeof value === "string") return value.trim().toLowerCase() === "yes";
  return value === true;
}

export function isApplicationOverdue(application: OverdueCandidate, now: Date = new Date()): boolean {
  if (!ELIGIBLE_STATUSES.has(application.currentStatus)) return false;
  if (INELIGIBLE_STATUSES.has(application.currentStatus)) return false;

  const scheduledDate = parseISO(application.followUpDate ?? "");
  if (isValid(scheduledDate)) {
    // An explicit next date stays authoritative even when an earlier follow-up was already completed.
    return !isAfter(scheduledDate, now);
  }

  // Without a schedule, completed follow-ups leave the queue while untouched applications use the age fallback.
  if ("followUps" in application && hasCompletedFollowUp(application.followUps)) return false;

  const appliedDate = parseISO(application.dateApplied);
  if (!isValid(appliedDate)) return false;

  // Missing or malformed schedules retain the legacy seven-day fallback for imported and older records.
  return isAfter(subDays(now, 7), appliedDate);
}
