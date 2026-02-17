import type { CurrentStatus, JobApplication } from "./types";

const COLLAPSE_SPACES = /\s+/g;

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
  if (lower === "auto-reply received" || lower === "auto reply received") return "Auto-reply received";
  if (lower === "human reply received" || lower === "human-reply received") return "Human reply received";

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

export type StatusBreakdownItem = {
  key: string;
  label: string;
  count: number;
};

const RESPONSE_STATUS_COLORS: Record<string, string> = {
  Applied: "hsl(213 94% 55%)",
  Interview: "hsl(142, 100%, 50%)",
  Offer: "hsl(127, 98%, 16%)",
  Rejected: "hsl(0 84% 60%)",
  "No Response": "hsl(217, 15%, 29%)",
  Assessment: "hsl(48 96% 53%)",
  "Auto-reply received": "hsl(213 94% 55%)",
  "Human reply received": "hsl(271 76% 53%)",
  "Pre-screen call": "hsl(241, 100%, 49%)",
};

export function getResponseStatusColor(raw: string): string {
  const normalized = normalizeResponseStatus(raw);
  return RESPONSE_STATUS_COLORS[normalized] ?? "hsl(215 16% 47%)";
}

export function getResponseStatusBadgeClass(raw: string, active: boolean): string {
  const status = normalizeResponseStatus(raw);

  if (status === "Rejected") return active ? "bg-red-600 text-white border-red-600" : "bg-red-50 text-red-700 border-red-300";
  if (status === "Assessment") return active ? "bg-yellow-500 text-black border-yellow-500" : "bg-yellow-50 text-yellow-800 border-yellow-300";
  if (status === "Interview") return active ? "bg-green-600 text-white border-green-600" : "bg-green-50 text-green-700 border-green-300";
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
  if (status === "Offer") return "Offer";
  if (status === "Rejected") return "Rejected";
  if (status === "No Response") return "No Response";
  if (status === "Interview" || status === "Assessment" || status === "Pre-screen call") return "Interview";
  return "Applied";
}

export function getEffectiveCurrentStatus(application: Pick<JobApplication, "currentStatus" | "responseStatus">): CurrentStatus {
  if (application.currentStatus !== "Applied") return application.currentStatus;
  return mapResponseStatusToCurrentStatus(application.responseStatus);
}
