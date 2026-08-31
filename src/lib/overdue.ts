import { addDays, differenceInCalendarDays, isAfter, isValid, parseISO, subDays } from "date-fns";
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

export function isFollowUpIgnored(application: Pick<OverdueCandidate, "dateApplied" | "followUpDate">, now: Date = new Date()): boolean {
  const scheduledDate = parseISO(application.followUpDate ?? "");
  const appliedDate = parseISO(application.dateApplied);
  // Age the reminder from its due date, including the existing seven-day fallback for unscheduled records.
  const dueDate = isValid(scheduledDate) ? scheduledDate : addDays(appliedDate, 7);
  return isValid(dueDate) && differenceInCalendarDays(now, dueDate) > 30;
}

export function isApplicationOverdue(application: OverdueCandidate, now: Date = new Date()): boolean {
  if (!ELIGIBLE_STATUSES.has(application.currentStatus)) return false;
  if (INELIGIBLE_STATUSES.has(application.currentStatus)) return false;
  // Ignoring stale reminders is derived only: keep records and history intact, and let rescheduling restore them.
  if (isFollowUpIgnored(application, now)) return false;

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
