export type CurrentStatus = "Applied" | "No Response" | "Pre-screen call" | "Assessment" | "Interview" | "Offer" | "Rejected" | "Withdrawn";
export type ResponseStatus =
  | "No response"
  | "Pre-screen call"
  | "Assessment"
  | "Interview"
  | "Rejected"
  | "Offer received"
  | "No response yet"
  | "Auto-reply received"
  | "Human reply received"
  | "Interview scheduled";

export const CURRENT_STATUSES: CurrentStatus[] = ["Applied", "No Response", "Pre-screen call", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"];
export const RESPONSE_STATUSES: ResponseStatus[] = ["No response", "Pre-screen call", "Assessment", "Interview", "Rejected", "Offer received"];

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
  "No Response": "bg-[hsl(var(--status-no-response))]",
  "Pre-screen call": "bg-[hsl(var(--status-pre-screen))]",
  Assessment: "bg-[hsl(var(--status-assessment))]",
  Interview: "bg-[hsl(var(--status-interview))]",
  Offer: "bg-[hsl(var(--status-offer))]",
  Rejected: "bg-[hsl(var(--status-rejected))]",
  Withdrawn: "bg-[hsl(var(--status-withdrawn))]",
};

export const STATUS_BADGE_CLASSES: Record<CurrentStatus, string> = {
  Applied: "bg-[hsl(var(--status-applied)/0.15)] text-[hsl(var(--status-applied))] border-[hsl(var(--status-applied)/0.3)]",
  "No Response": "bg-[hsl(var(--status-no-response)/0.15)] text-[hsl(var(--status-no-response))] border-[hsl(var(--status-no-response)/0.3)]",
  "Pre-screen call": "bg-[hsl(var(--status-pre-screen)/0.15)] text-[hsl(var(--status-pre-screen))] border-[hsl(var(--status-pre-screen)/0.3)]",
  Assessment: "bg-[hsl(var(--status-assessment)/0.15)] text-[hsl(var(--status-assessment))] border-[hsl(var(--status-assessment)/0.3)]",
  Interview: "bg-[hsl(var(--status-interview)/0.15)] text-[hsl(var(--status-interview))] border-[hsl(var(--status-interview)/0.3)]",
  Offer: "bg-[hsl(var(--status-offer)/0.15)] text-[hsl(var(--status-offer))] border-[hsl(var(--status-offer)/0.3)]",
  Rejected: "bg-[hsl(var(--status-rejected)/0.15)] text-[hsl(var(--status-rejected))] border-[hsl(var(--status-rejected)/0.3)]",
  Withdrawn: "bg-[hsl(var(--status-withdrawn)/0.15)] text-[hsl(var(--status-withdrawn))] border-[hsl(var(--status-withdrawn)/0.3)]",
};
