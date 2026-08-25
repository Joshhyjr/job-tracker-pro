// Status types — CurrentStatus is a fixed enum, responseStatus is a dynamic string
export type CurrentStatus = "Applied" | "No Response" | "Pre-screen call" | "Assessment" | "Interview" | "Offer" | "Rejected" | "Withdrawn";

export const CURRENT_STATUSES: CurrentStatus[] = ["Applied", "No Response", "Pre-screen call", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];

// Geographic metadata uses stable ISO/work-mode values while legacy location text remains display-compatible.
export type WorkMode = "Remote" | "Hybrid" | "On-site";
export type LocationStatus = "resolved" | "needs_review" | "work_mode_only";

// Keep form-select options aligned with the app's canonical response-status labels so
// new records and edits do not drift away from the values used by filters and charts.
export const RESPONSE_STATUSES: string[] = [
  "Applied",
  "No Response",
  "Pre-screen call",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
  "On Hold",
  "Role Cancelled",
  "Auto-reply received",
  "Human reply received",
];

export interface ActivityLogEntry {
  id: string;
  date: string;
  type: "status_change" | "follow_up" | "note";
  message: string;
  /** Structured status values let the detail page render a clear from-to history while keeping older message-only entries compatible. */
  fromStatus?: string;
  toStatus?: string;
}

export interface JobApplication {
  id: string;
  /** Cloud sync timestamps remain optional so existing XLSX and browser records stay compatible. */
  createdAt?: string;
  updatedAt?: string;
  jobTitle: string;
  companyName: string;
  location: string;
  /** Optional parsed geography used by the locations map without changing the table's location field. */
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  workMode?: WorkMode;
  locationStatus?: LocationStatus;
  currentStatus: CurrentStatus;
  /** Dynamic — can be any string from the imported dataset */
  responseStatus: string;
  followUps: boolean;
  dateApplied: string;
  notes: string;
  followUpDate: string;
  /** Optional fields captured from flexible spreadsheet templates. */
  jobLink?: string;
  /** Verified employer domain used by the company logo service (manual override wins over link parsing). */
  companyDomain?: string;
  /** Explicit logo image URL that bypasses domain-based resolution. */
  companyLogoUrl?: string;
  salary?: string;
  daysSinceApplied?: number;
  coverLetterIncluded?: boolean;
  recruiterContactName?: string;
  interviewDate?: string;
  tags?: string;
  /** Unknown spreadsheet columns are preserved here using their original header names. */
  customFields?: Record<string, string>;
  activityLog: ActivityLogEntry[];
}

/** Workbook merge provenance keeps omitted columns from being mistaken for intentional blank values. */
export interface ApplicationImportFieldPresence {
  applicationFields: Array<Exclude<keyof JobApplication, "id" | "createdAt" | "updatedAt" | "activityLog" | "customFields">>;
  customFieldHeaders: string[];
}

// Badge classes keyed by CurrentStatus for the legacy status badge
export const STATUS_BADGE_CLASSES: Record<CurrentStatus, string> = {
  Applied: "bg-[hsl(var(--status-applied)/0.12)] text-[hsl(var(--status-applied))] border-[hsl(var(--status-applied)/0.2)]",
  "No Response": "bg-[hsl(var(--status-no-response)/0.12)] text-[hsl(var(--status-no-response))] border-[hsl(var(--status-no-response)/0.2)]",
  "Pre-screen call": "bg-[hsl(var(--status-pre-screen-call)/0.12)] text-[hsl(var(--status-pre-screen-call))] border-[hsl(var(--status-pre-screen-call)/0.2)]",
  Assessment: "bg-[hsl(var(--status-interview)/0.12)] text-[hsl(var(--status-interview))] border-[hsl(var(--status-interview)/0.2)]",
  Interview: "bg-[hsl(var(--status-interview)/0.12)] text-[hsl(var(--status-interview))] border-[hsl(var(--status-interview)/0.2)]",
  Offer: "bg-[hsl(var(--status-offer)/0.12)] text-[hsl(var(--status-offer))] border-[hsl(var(--status-offer)/0.2)]",
  Rejected: "bg-[hsl(var(--status-rejected)/0.12)] text-[hsl(var(--status-rejected))] border-[hsl(var(--status-rejected)/0.2)]",
  Withdrawn: "bg-[hsl(var(--status-withdrawn)/0.12)] text-[hsl(var(--status-withdrawn))] border-[hsl(var(--status-withdrawn)/0.2)]",
};
