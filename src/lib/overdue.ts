import { isAfter, isValid, parseISO, subDays } from "date-fns";
import type { CurrentStatus, JobApplication } from "@/lib/types";

type OverdueCandidate = Pick<JobApplication, "dateApplied" | "currentStatus"> & {
  followUps?: boolean | string | null;
};

const ELIGIBLE_STATUSES = new Set<CurrentStatus>(["Applied", "No Response"]);
const INELIGIBLE_STATUSES = new Set<CurrentStatus>(["Rejected", "Withdrawn", "Offer", "Pre-screen call", "Interview"]);

function hasYesFollowUp(value: OverdueCandidate["followUps"]): boolean {
  if (typeof value === "string") return value.trim().toLowerCase() === "yes";
  return value === true;
}

export function isApplicationOverdue(application: OverdueCandidate, now: Date = new Date()): boolean {
  const appliedDate = parseISO(application.dateApplied);
  if (!isValid(appliedDate)) return false;

  if (!ELIGIBLE_STATUSES.has(application.currentStatus)) return false;
  if (INELIGIBLE_STATUSES.has(application.currentStatus)) return false;

  if ("followUps" in application && !hasYesFollowUp(application.followUps)) return false;

  return isAfter(subDays(now, 7), appliedDate);
}
