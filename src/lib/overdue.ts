import { addDays, differenceInCalendarDays, isAfter, isValid, parseISO, subDays } from "date-fns";
import type { CurrentStatus, JobApplication } from "@/lib/types";
import { getEffectiveCurrentStatus, normalizeResponseStatus } from "@/lib/responseStatus";

type OverdueCandidate = Pick<JobApplication, "dateApplied" | "currentStatus"> & {
  responseStatus?: string | null;
  followUps?: boolean | string | null;
  followUpDate?: string | null;
};

export type ScheduledFollowUpState = "upcoming" | "overdue" | "ignored" | "completed" | "hidden";

function hasCompletedFollowUp(value: OverdueCandidate["followUps"]): boolean {
  if (typeof value === "string") return value.trim().toLowerCase() === "yes";
  return value === true;
}

function getFollowUpCurrentStatus(application: OverdueCandidate): CurrentStatus {
  // Response status normally drives the fixed bucket, while the stored current status remains the fallback for older imports.
  return getEffectiveCurrentStatus({
    currentStatus: application.currentStatus,
    responseStatus: application.responseStatus ?? "",
  });
}

function isFollowUpQueueEligible(application: OverdueCandidate): boolean {
  const responseStatus = normalizeResponseStatus(application.responseStatus);
  // Follow-up work begins only while an application is newly applied or has an automated acknowledgement.
  return (responseStatus === "Applied" || responseStatus === "Auto-reply received")
    && getFollowUpCurrentStatus(application) === "Applied";
}

export function isFollowUpIgnored(application: Pick<OverdueCandidate, "dateApplied" | "followUpDate">, now: Date = new Date()): boolean {
  const scheduledDate = parseISO(application.followUpDate ?? "");
  const appliedDate = parseISO(application.dateApplied);
  // Age the reminder from its due date, including the existing seven-day fallback for unscheduled records.
  const dueDate = isValid(scheduledDate) ? scheduledDate : addDays(appliedDate, 7);
  return isValid(dueDate) && differenceInCalendarDays(now, dueDate) > 30;
}

export function getScheduledFollowUpState(application: OverdueCandidate, now: Date = new Date()): ScheduledFollowUpState {
  const scheduledDate = parseISO(application.followUpDate ?? "");

  // Completion is a recorded user action and remains visible even after the application later reaches a terminal status.
  if (hasCompletedFollowUp(application.followUps)) return "completed";

  if (!isValid(scheduledDate)) {
    // Unscheduled pending records do not enter the confirmed-reminder queues.
    return "hidden";
  }

  if (!isFollowUpQueueEligible(application)) return "hidden";
  if (isFollowUpIgnored(application, now)) return "ignored";
  return isAfter(scheduledDate, now) ? "upcoming" : "overdue";
}

export function isApplicationOverdue(application: OverdueCandidate, now: Date = new Date()): boolean {
  const scheduledDate = parseISO(application.followUpDate ?? "");
  if (isValid(scheduledDate)) return getScheduledFollowUpState(application, now) === "overdue";

  if (!isFollowUpQueueEligible(application)) return false;
  // Ignoring stale reminders is derived only: keep records and history intact, and let rescheduling restore them.
  if (isFollowUpIgnored(application, now)) return false;

  // Without a schedule, completed follow-ups leave the queue while untouched applications use the age fallback.
  if ("followUps" in application && hasCompletedFollowUp(application.followUps)) return false;

  const appliedDate = parseISO(application.dateApplied);
  if (!isValid(appliedDate)) return false;

  // Missing or malformed schedules retain the legacy seven-day fallback for imported and older records.
  return isAfter(subDays(now, 7), appliedDate);
}
