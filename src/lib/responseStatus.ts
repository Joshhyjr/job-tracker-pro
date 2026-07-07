import type { ActivityLogEntry, CurrentStatus, JobApplication } from "./types";

const COLLAPSE_SPACES = /\s+/g;
const STANDARD_RESPONSE_STATUSES = new Set([
  "Applied",
  "Pre-screen call",
  "Interview",
  "Offer",
  "Rejected",
  "No Response",
  "Assessment",
  "On Hold",
  "Role Cancelled",
]);

export function normalizeResponseStatus(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "Applied";

  const lower = value.toLowerCase().replace(COLLAPSE_SPACES, " ");

  if (lower === "offer received" || lower === "offer") return "Offer";
  if (lower.startsWith("interview")) return "Interview";
  if (lower === "pre-screen call" || lower === "prescreen call" || lower === "pre screen call") return "Pre-screen call";
  if (lower === "rejected") return "Rejected";
  if (lower === "no response" || lower === "no response yet") return "No Response";
  if (lower === "assessment") return "Assessment";
  if (lower === "on hold" || lower === "hold") return "On Hold";
  if (lower === "auto-reply received" || lower === "auto reply received") return "Auto-reply received";
  if (lower === "human reply received" || lower === "human-reply received") return "Human reply received";
  if (lower === "role cancelled" || lower === "role canceled") return "Role Cancelled";

  return value
    .replace(COLLAPSE_SPACES, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeResponseStatusList(rawList: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  rawList.forEach((item) => {
    const status = normalizeResponseStatus(item);
    if (!seen.has(status)) {
      seen.add(status);
      normalized.push(status);
    }
  });

  return normalized;
}

export function buildResponseStatusOptions(currentResponseStatus: string, defaults: string[]): string[] {
  const normalizedDefaults = normalizeResponseStatusList(defaults);
  const trimmedCurrent = String(currentResponseStatus ?? "").trim();

  if (!trimmedCurrent) return normalizedDefaults;

  const normalizedCurrent = normalizeResponseStatus(trimmedCurrent);
  // Preserve exact imported/custom labels when they contain more detail than the canonical bucket name.
  if (normalizedDefaults.some((status) => status === normalizedCurrent) && normalizedCurrent === trimmedCurrent) {
    return normalizedDefaults;
  }

  return [...normalizedDefaults, trimmedCurrent];
}

export type StatusBreakdownItem = {
  key: string;
  label: string;
  count: number;
};

// Central colour mapping for all application statuses — single source of truth
// used by the pie chart, legend, badges, recent applications list, and insights.
// Keeps colours consistent across the app and readable on light + dark themes.
const RESPONSE_STATUS_COLORS: Record<string, string> = {
  Applied: "hsl(213 90% 56%)",                // blue
  Active: "hsl(213 90% 56%)",                  // blue (alias)
  Assessment: "hsl(45 95% 55%)",               // yellow
  "Auto-reply received": "hsl(200 85% 65%)",   // light blue
  "Human reply received": "hsl(271 70% 55%)",  // purple — distinct human reply
  Interview: "hsl(142 65% 45%)",               // green
  Offer: "hsl(152 75% 40%)",                   // emerald
  "On Hold": "hsl(35 90% 48%)",                // amber
  "No Response": "hsl(215 14% 50%)",           // slate / grey
  "Pre-screen call": "hsl(243 75% 58%)",       // indigo
  Rejected: "hsl(0 72% 55%)",                  // red
  "Role Cancelled": "hsl(220 10% 30%)",        // dark grey
  Withdrawn: "hsl(28 85% 55%)",                // orange
  "Not Applied": "hsl(215 12% 70%)",           // muted grey
};

// Fallback colour for unknown/custom statuses imported from external data.
const FALLBACK_STATUS_COLOR = "hsl(215 16% 47%)";

export function getResponseStatusColor(raw: string): string {
  const normalized = normalizeResponseStatus(raw);
  return RESPONSE_STATUS_COLORS[normalized] ?? FALLBACK_STATUS_COLOR;
}

/**
 * Inline style for a soft, glass-friendly status pill driven by the central colour map.
 * Used where statuses are dynamic (e.g. Recent Applications, Insights) and can't rely
 * on the fixed STATUS_BADGE_CLASSES enum.
 */
export function getResponseStatusBadgeStyle(raw: string): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const color = getResponseStatusColor(raw);
  // Convert "hsl(h s% l%)" → tinted variants with alpha for bg + border.
  const inner = color.replace(/^hsl\(|\)$/g, "");
  return {
    backgroundColor: `hsl(${inner} / 0.14)`,
    color,
    borderColor: `hsl(${inner} / 0.3)`,
  };
}

export function getResponseStatusBadgeClass(raw: string, active: boolean): string {
  const status = normalizeResponseStatus(raw);

  if (status === "Rejected") return active ? "bg-red-600 text-white border-red-600" : "bg-red-50 text-red-700 border-red-300";
  if (status === "Assessment") return active ? "bg-yellow-500 text-black border-yellow-500" : "bg-yellow-50 text-yellow-800 border-yellow-300";
  if (status === "Interview") return active ? "bg-green-600 text-white border-green-600" : "bg-green-50 text-green-700 border-green-300";
  if (status === "On Hold") return active ? "bg-amber-600 text-white border-amber-600" : "bg-amber-50 text-amber-800 border-amber-300";
  if (status === "No Response") return active ? "bg-slate-700 text-white border-slate-700" : "bg-slate-100 text-slate-700 border-slate-300";
  if (status === "Pre-screen call") return active ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-300";

  return active ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-300";
}

export function computeStatusBreakdown(applications: JobApplication[], preferredOrder: string[] = []): StatusBreakdownItem[] {
  const counts = new Map<string, number>();

  applications.forEach((application) => {
    const normalized = normalizeResponseStatus(application.responseStatus);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  if (counts.size === 0 && applications.length > 0) {
    counts.set("Applied", applications.length);
  }

  const normalizedOrder = normalizeResponseStatusList(preferredOrder);
  const ordered: StatusBreakdownItem[] = [];
  const seen = new Set<string>();

  normalizedOrder.forEach((status) => {
    if (!counts.has(status)) return;
    seen.add(status);
    ordered.push({ key: status, label: status, count: counts.get(status) ?? 0 });
  });

  const extras = Array.from(counts.keys())
    .filter((status) => !seen.has(status))
    .sort((a, b) => a.localeCompare(b));

  extras.forEach((status) => {
    ordered.push({ key: status, label: status, count: counts.get(status) ?? 0 });
  });

  return ordered;
}

export function mapResponseStatusToCurrentStatus(raw: string | null | undefined): CurrentStatus {
  const status = normalizeResponseStatus(raw);
  if (status === "Pre-screen call") return "Pre-screen call";
  if (status === "Offer") return "Offer";
  if (status === "Rejected") return "Rejected";
  if (status === "No Response") return "No Response";
  if (status === "Interview" || status === "Assessment") return "Interview";
  // On Hold is tracked as a response-stage label while the fixed current-status enum keeps it in the active Applied bucket.
  if (status === "On Hold") return "Applied";
  // Cancelled roles are no longer active, so keep them out of the generic Applied bucket.
  if (status === "Role Cancelled") return "Withdrawn";
  if (status === "Withdrawn") return "Withdrawn";
  return "Applied";
}

export function getEffectiveCurrentStatus(application: Pick<JobApplication, "currentStatus" | "responseStatus">): CurrentStatus {
  const responseDerivedStatus = mapResponseStatusToCurrentStatus(application.responseStatus);
  if (responseDerivedStatus !== "Applied") return responseDerivedStatus;
  return application.currentStatus;
}

export function mapCurrentStatusToResponseStatus(status: CurrentStatus): string | null {
  if (status === "Applied") return "Applied";
  if (status === "Pre-screen call") return "Pre-screen call";
  if (status === "Interview") return "Interview";
  if (status === "Offer") return "Offer";
  if (status === "Rejected") return "Rejected";
  if (status === "No Response") return "No Response";
  return null;
}

function isStandardResponseStatus(status: string): boolean {
  return STANDARD_RESPONSE_STATUSES.has(status);
}

export function syncEditedResponseStatus(
  previousStatus: CurrentStatus,
  nextStatus: CurrentStatus,
  currentResponseStatus: string,
): string {
  const previousMappedResponse = mapCurrentStatusToResponseStatus(previousStatus);
  const nextMappedResponse = mapCurrentStatusToResponseStatus(nextStatus);
  const normalizedCurrentResponse = normalizeResponseStatus(currentResponseStatus);

  // Only auto-sync when the response status is blank or still matches the previous
  // status-derived value. That keeps common form edits aligned without clobbering
  // a deliberate manual override such as a custom imported response stage.
  if (
    !currentResponseStatus.trim()
    || normalizedCurrentResponse === previousMappedResponse
    || isStandardResponseStatus(normalizedCurrentResponse)
  ) {
    return nextMappedResponse ?? currentResponseStatus;
  }

  return currentResponseStatus;
}

export function buildStatusChangeApplication(
  application: JobApplication,
  status: CurrentStatus,
  entryId: string,
  changedAt: string,
): JobApplication {
  const entry: ActivityLogEntry = {
    id: entryId,
    date: changedAt,
    type: "status_change",
    message: `Status changed to ${status}`,
  };

  return {
    ...application,
    currentStatus: status,
    // Quick actions should mirror edit-form behavior: advance the paired response status
    // when it is still status-derived, but keep deliberate custom stages intact.
    responseStatus: syncEditedResponseStatus(application.currentStatus, status, application.responseStatus),
    activityLog: [entry, ...(application.activityLog || [])],
  };
}

export function buildQuickActionResponseStatuses(
  preferredOrder: string[],
  defaults: string[],
  currentResponseStatus: string,
): string[] {
  const source = preferredOrder.length > 0 ? preferredOrder : defaults;
  const current = normalizeResponseStatus(currentResponseStatus);

  // Quick actions prefer the workbook's status list, falling back to app defaults when no XLSX list was imported.
  return normalizeResponseStatusList(source).filter((status) => status !== current);
}

export function buildResponseStatusChangeApplication(
  application: JobApplication,
  responseStatus: string,
  entryId: string,
  changedAt: string,
): JobApplication {
  const normalizedResponseStatus = normalizeResponseStatus(responseStatus);
  const nextCurrentStatus = mapResponseStatusToCurrentStatus(normalizedResponseStatus);
  const entry: ActivityLogEntry = {
    id: entryId,
    date: changedAt,
    type: "status_change",
    message: `Status changed to ${normalizedResponseStatus}`,
  };

  // Dynamic quick actions save the selected response label, then mirror the closest fixed current-status bucket.
  return {
    ...application,
    currentStatus: nextCurrentStatus,
    responseStatus: normalizedResponseStatus,
    activityLog: [entry, ...(application.activityLog || [])],
  };
}
