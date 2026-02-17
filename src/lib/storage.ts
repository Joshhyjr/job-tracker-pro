import * as XLSX from "xlsx";
import type { JobApplication, CurrentStatus, ResponseStatus } from "./types";

const STORAGE_KEY = "job-tracker-data";
const SEEDED_KEY = "job-tracker-seeded";

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function parseExcelDate(val: unknown): string {
  if (!val) return "";
  if (typeof val === "number") {
    // Excel serial date
    const date = new Date((val - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }
  const s = String(val).trim();
  // try M/D/YY or M/D/YYYY
  const parts = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (parts) {
    let year = parseInt(parts[3]);
    if (year < 100) year += 2000;
    return `${year}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
  }
  return s;
}

function mapStatus(val: unknown): CurrentStatus {
  const s = String(val || "").trim();
  const map: Record<string, CurrentStatus> = {
    applied: "Applied", interview: "Interview", offer: "Offer",
    rejected: "Rejected", "no response": "No Response", withdrawn: "Withdrawn",
  };
  return map[s.toLowerCase()] || "Applied";
}

function mapResponseStatus(val: unknown): ResponseStatus {
  const s = String(val || "").trim().toLowerCase();
  if (s.includes("auto")) return "Auto-reply received";
  if (s.includes("human")) return "Human reply received";
  if (s.includes("interview")) return "Interview scheduled";
  if (s.includes("offer")) return "Offer received";
  if (s.includes("rejected")) return "Rejected";
  return "No response yet";
}
/// Functions below handle parsing and mapping of Excel data to our application's data model.
export async function loadSeedData(): Promise<JobApplication[]> {
  const resp = await fetch("/seed-data.xlsx");
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return mapRowsToApplications(rows);
}


export async function importApplicationsFromFile(file: File): Promise<JobApplication[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  return mapRowsToApplications(rows);
}

// Maps raw Excel rows to our JobApplication data structure, applying necessary transformations and defaults.
function mapRowsToApplications(rows: Record<string, unknown>[]): JobApplication[] {
  return rows
    .filter((r) => r["Job Title"] && String(r["Job Title"]).trim())
    .map((r) => ({
      id: generateId(),
      jobTitle: String(r["Job Title"] || "").trim(),
      companyName: String(r["Company Name"] || "").trim(),
      location: String(r["Location"] || "").trim(),
      currentStatus: mapStatus(r["Current Status"]),
      responseStatus: mapResponseStatus(r["Response Status"]),
      followUps: String(r["Follow Ups"] || "").toLowerCase() === "yes",
      dateApplied: parseExcelDate(r["Date Applied"]),
      notes: String(r["Notes"] || "").trim(),
      followUpDate: parseExcelDate(r["Follow-Up Date"]),
      activityLog: [],
    }));
}

export function getApplications(): JobApplication[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveApplications(apps: JobApplication[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

export function isSeeded(): boolean {
  return localStorage.getItem(SEEDED_KEY) === "true";
}

export function markSeeded() {
  localStorage.setItem(SEEDED_KEY, "true");
}

export function addApplication(app: Omit<JobApplication, "id" | "activityLog">): JobApplication {
  const newApp: JobApplication = { ...app, id: generateId(), activityLog: [{ id: generateId(), date: new Date().toISOString(), type: "note", message: "Application created" }] };
  const apps = getApplications();
  apps.unshift(newApp);
  saveApplications(apps);
  return newApp;
}

export function updateApplication(updated: JobApplication) {
  const apps = getApplications().map((a) => (a.id === updated.id ? updated : a));
  saveApplications(apps);
}

export function deleteApplication(id: string) {
  saveApplications(getApplications().filter((a) => a.id !== id));
}
