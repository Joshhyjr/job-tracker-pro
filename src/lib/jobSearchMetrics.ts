import {
  addDays,
  differenceInCalendarDays,
  format,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import type { JobApplication } from "./types";
import { normalizeResponseStatus } from "./responseStatus";

export const MATURE_COHORT_MIN_DAYS = 21;
export const MATURE_COHORT_MAX_DAYS = 90;
export const LOW_SIGNAL_MIN_DENOMINATOR = 20;
export const LOW_SIGNAL_MIN_EVENTS = 5;

const AWAITING_HUMAN_STATUSES = new Set(["Applied", "Auto-reply received", "No Response"]);
const ACTIVE_PROCESS_STATUSES = new Set(["Human reply received", "Pre-screen call", "Assessment", "Interview", "Final Interview"]);
const POSITIVE_PROGRESSION_STATUSES = new Set([...ACTIVE_PROCESS_STATUSES, "Offer"]);
const INTERVIEW_STATUSES = new Set(["Interview", "Final Interview", "Offer"]);
const TERMINAL_CURRENT_STATUSES = new Set(["Rejected", "Role Cancelled", "Withdrawn", "Offer"]);

export type MetricSignal = "low-signal" | "established";

export interface WeeklyApplicationMetric {
  week: string;
  weekStart: string;
  total: number;
  qualified: number;
}

export interface ConversionMetric {
  count: number;
  denominator: number;
  rate: number;
  signal: MetricSignal;
}

export interface JobSearchMetrics {
  qualifiedThisWeek: number;
  recentQualifiedWeeklyMedian: number;
  awaitingHumanResponse: number;
  activeProcess: number;
  stale: number;
  followUpsDue: number;
  offersLast90Days: number;
  totalApplications: number;
  rejections: number;
  invalidOrFutureDateCount: number;
  unclassifiedStatusCount: number;
  qualityCoverageCount: number;
  cohort: {
    start: string;
    end: string;
    size: number;
  };
  positiveProgression: ConversionMetric;
  interviews: ConversionMetric;
  offers: ConversionMetric;
  funnel: Array<{ stage: string; count: number }>;
  weeklyTrend: WeeklyApplicationMetric[];
}

function parseApplicationDate(value: string): Date | null {
  const parsed = parseISO(value || "");
  return isValid(parsed) ? startOfDay(parsed) : null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function rate(count: number, denominator: number): number {
  return denominator > 0 ? Math.round((count / denominator) * 100) : 0;
}

function signal(count: number, denominator: number): MetricSignal {
  return denominator < LOW_SIGNAL_MIN_DENOMINATOR || count < LOW_SIGNAL_MIN_EVENTS ? "low-signal" : "established";
}

function normalizeMetricStatus(raw: string | null | undefined): string {
  const normalized = normalizeResponseStatus(raw);
  // Preserve final-round meaning for funnel classification even though it maps to the broader interview stage.
  return normalized.toLowerCase() === "final interview" ? "Final Interview" : normalized;
}

function getCurrentMetricStatus(application: Pick<JobApplication, "currentStatus" | "responseStatus">): string {
  const responseStatus = normalizeMetricStatus(application.responseStatus);
  // Current-status-only workbooks receive Applied as a response fallback, so retain their meaningful imported stage.
  return responseStatus === "Applied" ? normalizeMetricStatus(application.currentStatus) : responseStatus;
}

export function getApplicationStages(application: JobApplication): Set<string> {
  const stages = new Set<string>();
  const addStage = (value: string | null | undefined) => {
    if (String(value ?? "").trim()) stages.add(normalizeMetricStatus(value));
  };

  addStage(application.currentStatus);
  addStage(application.responseStatus);
  application.activityLog?.forEach((entry) => {
    if (entry.type !== "status_change") return;
    addStage(entry.fromStatus);
    addStage(entry.toStatus);
  });

  // Later stages imply earlier funnel progress when an imported snapshot lacks detailed history.
  if (stages.has("Offer")) stages.add("Interview");
  if (stages.has("Final Interview")) stages.add("Interview");
  return stages;
}

export function isQualifiedApplication(application: Pick<JobApplication, "roleFit" | "resumeTailored">): boolean {
  return application.resumeTailored === true && (application.roleFit === "strong" || application.roleFit === "moderate");
}

export function hasPositiveProgression(application: JobApplication): boolean {
  return [...getApplicationStages(application)].some((stage) => POSITIVE_PROGRESSION_STATUSES.has(stage));
}

export function hasReachedInterview(application: JobApplication): boolean {
  return [...getApplicationStages(application)].some((stage) => INTERVIEW_STATUSES.has(stage));
}

export function hasReachedOffer(application: JobApplication): boolean {
  return getApplicationStages(application).has("Offer");
}

export function isIntentionallyDueForFollowUp(application: JobApplication, now = new Date()): boolean {
  if (!application.followUpDate || application.followUps) return false;
  if (TERMINAL_CURRENT_STATUSES.has(getCurrentMetricStatus(application))) return false;
  const dueDate = parseApplicationDate(application.followUpDate);
  return Boolean(dueDate && !isBefore(startOfDay(now), dueDate));
}

function isKnownMetricStatus(status: string): boolean {
  return AWAITING_HUMAN_STATUSES.has(status)
    || ACTIVE_PROCESS_STATUSES.has(status)
    || TERMINAL_CURRENT_STATUSES.has(status)
    || status === "On Hold";
}

export function buildJobSearchMetrics(applications: JobApplication[], now = new Date()): JobSearchMetrics {
  const today = startOfDay(now);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const cohortStart = subDays(today, MATURE_COHORT_MAX_DAYS);
  const cohortEnd = subDays(today, MATURE_COHORT_MIN_DAYS);
  let invalidOrFutureDateCount = 0;

  const datedApplications = applications.flatMap((application) => {
    const date = parseApplicationDate(application.dateApplied);
    if (!date || isBefore(today, date)) {
      invalidOrFutureDateCount++;
      return [];
    }
    return [{ application, date, age: differenceInCalendarDays(today, date) }];
  });

  const weeklyTrend = Array.from({ length: 13 }, (_, index) => {
    const start = subWeeks(weekStart, 12 - index);
    const end = addDays(start, 7);
    const rows = datedApplications.filter(({ date }) => !isBefore(date, start) && isBefore(date, end));
    return {
      week: format(start, "MMM d"),
      weekStart: format(start, "yyyy-MM-dd"),
      total: rows.length,
      qualified: rows.filter(({ application }) => isQualifiedApplication(application)).length,
    };
  });

  const previousFourWeekCounts = Array.from({ length: 4 }, (_, index) => {
    const start = subWeeks(weekStart, index + 1);
    const end = addDays(start, 7);
    return datedApplications.filter(({ application, date }) => (
      !isBefore(date, start) && isBefore(date, end) && isQualifiedApplication(application)
    )).length;
  });

  const matureCohort = datedApplications
    .filter(({ age }) => age >= MATURE_COHORT_MIN_DAYS && age <= MATURE_COHORT_MAX_DAYS)
    .map(({ application }) => application);
  const positiveCount = matureCohort.filter(hasPositiveProgression).length;
  const interviewCount = matureCohort.filter(hasReachedInterview).length;
  const offerCount = matureCohort.filter(hasReachedOffer).length;

  let awaitingHumanResponse = 0;
  let activeProcess = 0;
  let stale = 0;
  let unclassifiedStatusCount = 0;

  datedApplications.forEach(({ application, age }) => {
    const currentStatus = getCurrentMetricStatus(application);
    if (AWAITING_HUMAN_STATUSES.has(currentStatus)) {
      if (age >= MATURE_COHORT_MIN_DAYS) stale++;
      else awaitingHumanResponse++;
    } else if (ACTIVE_PROCESS_STATUSES.has(currentStatus)) {
      activeProcess++;
    } else if (!isKnownMetricStatus(currentStatus)) {
      unclassifiedStatusCount++;
    }
  });

  const denominator = matureCohort.length;
  const offerWindowCount = datedApplications
    .filter(({ age }) => age <= MATURE_COHORT_MAX_DAYS)
    .filter(({ application }) => hasReachedOffer(application)).length;

  return {
    qualifiedThisWeek: datedApplications.filter(({ application, date }) => (
      !isBefore(date, weekStart) && !isBefore(today, date) && isQualifiedApplication(application)
    )).length,
    recentQualifiedWeeklyMedian: median(previousFourWeekCounts),
    awaitingHumanResponse,
    activeProcess,
    stale,
    followUpsDue: applications.filter((application) => isIntentionallyDueForFollowUp(application, today)).length,
    offersLast90Days: offerWindowCount,
    totalApplications: applications.length,
    rejections: applications.filter((application) => getCurrentMetricStatus(application) === "Rejected").length,
    invalidOrFutureDateCount,
    unclassifiedStatusCount,
    qualityCoverageCount: applications.filter((application) => application.roleFit !== undefined && application.resumeTailored !== undefined).length,
    cohort: {
      start: format(cohortStart, "yyyy-MM-dd"),
      end: format(cohortEnd, "yyyy-MM-dd"),
      size: denominator,
    },
    positiveProgression: { count: positiveCount, denominator, rate: rate(positiveCount, denominator), signal: signal(positiveCount, denominator) },
    interviews: { count: interviewCount, denominator, rate: rate(interviewCount, denominator), signal: signal(interviewCount, denominator) },
    offers: { count: offerCount, denominator, rate: rate(offerCount, denominator), signal: signal(offerCount, denominator) },
    funnel: [
      { stage: "Submitted", count: denominator },
      { stage: "Positive progression", count: positiveCount },
      { stage: "Interview", count: interviewCount },
      { stage: "Offer", count: offerCount },
    ],
    weeklyTrend,
  };
}
