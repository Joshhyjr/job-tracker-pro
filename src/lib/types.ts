export type CurrentStatus = "Applied" | "Pre-screen call" | "Interview" | "Offer" | "Rejected" | "No Response" | "Withdrawn";
export type ResponseStatus = string;

export const CURRENT_STATUSES: CurrentStatus[] = ["Applied", "Pre-screen call", "Interview", "Offer", "Rejected", "No Response", "Withdrawn"];
export const RESPONSE_STATUSES: ResponseStatus[] = ["No Response", "Auto-reply received", "Human reply received", "Pre-screen call", "Interview", "Offer", "Rejected", "Assessment"];

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
  currentStatus: CurrentStatus;
  responseStatus: ResponseStatus;
  followUps: boolean;
  dateApplied: string;
  notes: string;
  followUpDate: string;
  activityLog: ActivityLogEntry[];
}

export const STATUS_COLORS: Record<CurrentStatus, string> = {
  Applied: "bg-[hsl(var(--status-applied))]",
  "Pre-screen call": "bg-[hsl(var(--status-pre-screen-call))]",
  Interview: "bg-[hsl(var(--status-interview))]",
  Offer: "bg-[hsl(var(--status-offer))]",
  Rejected: "bg-[hsl(var(--status-rejected))]",
  "No Response": "bg-[hsl(var(--status-no-response))]",
  Withdrawn: "bg-[hsl(var(--status-withdrawn))]",
};

export const STATUS_BADGE_CLASSES: Record<CurrentStatus, string> = {
  Applied: "bg-[hsl(var(--status-applied)/0.15)] text-[hsl(var(--status-applied))] border-[hsl(var(--status-applied)/0.3)]",
  "Pre-screen call": "bg-[hsl(var(--status-pre-screen-call)/0.15)] text-[hsl(var(--status-pre-screen-call))] border-[hsl(var(--status-pre-screen-call)/0.3)]",
  Interview: "bg-[hsl(var(--status-interview)/0.15)] text-[hsl(var(--status-interview))] border-[hsl(var(--status-interview)/0.3)]",
  Offer: "bg-[hsl(var(--status-offer)/0.15)] text-[hsl(var(--status-offer))] border-[hsl(var(--status-offer)/0.3)]",
  Rejected: "bg-[hsl(var(--status-rejected)/0.15)] text-[hsl(var(--status-rejected))] border-[hsl(var(--status-rejected)/0.3)]",
  "No Response": "bg-[hsl(var(--status-no-response)/0.15)] text-[hsl(var(--status-no-response))] border-[hsl(var(--status-no-response)/0.3)]",
  Withdrawn: "bg-[hsl(var(--status-withdrawn)/0.15)] text-[hsl(var(--status-withdrawn))] border-[hsl(var(--status-withdrawn)/0.3)]",
};
