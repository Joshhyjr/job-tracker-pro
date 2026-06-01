// Status types — CurrentStatus is a fixed enum, responseStatus is a dynamic string
export type CurrentStatus = "Applied" | "No Response" | "Pre-screen call" | "Assessment" | "Interview" | "Offer" | "Rejected" | "Withdrawn";

export const CURRENT_STATUSES: CurrentStatus[] = ["Applied", "No Response", "Pre-screen call", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];

// ResponseStatus is intentionally `string` so it can hold any value from imported data
export const RESPONSE_STATUSES: string[] = ["No response", "Pre-screen call", "Assessment", "Interview", "Rejected", "Offer received"];

export interface ActivityLogEntry {
  id: string;
  date: string;
  type: "status_change" | "follow_up" | "note";
  message: string;
}

export interface JobApplication {
  id: string;
  jobTitle: string;
  companyName: string;
  location: string;
  /** Optional parsed geography used by the locations map without changing the table's location field. */
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  currentStatus: CurrentStatus;
  /** Dynamic — can be any string from the imported dataset */
  responseStatus: string;
  followUps: boolean;
  dateApplied: string;
  notes: string;
  followUpDate: string;
  /** Optional fields captured from flexible spreadsheet templates. */
  jobLink?: string;
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
