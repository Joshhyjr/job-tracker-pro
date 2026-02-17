import * as XLSX from "xlsx";
import type { JobApplication, CurrentStatus, ResponseStatus } from "./types";
import { normalizeResponseStatus, normalizeResponseStatusList } from "./responseStatus";

const STORAGE_KEY = "job-tracker-data";
const SEEDED_KEY = "job-tracker-seeded";
const RESPONSE_STATUS_ORDER_KEY = "job-tracker-response-status-order";
const IMPORT_WARNINGS_KEY = "job-tracker-import-warnings";

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
  return normalizeResponseStatus(val == null ? "" : String(val));
}

function normalizeHeaderName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCellByHeader(row: Record<string, unknown>, headerCandidates: string[]): unknown {
  const entries = Object.entries(row);
  for (const [key, value] of entries) {
    const normalized = normalizeHeaderName(key);
    if (headerCandidates.some((candidate) => normalizeHeaderName(candidate) === normalized)) {
      return value;
    }
  }
  return "";
}

function extractResponseStatusOrderFromListSheet(sheet?: XLSX.WorkSheet): string[] {
  if (!sheet) return [];

  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, defval: "" });
  let anchorRow = -1;
  let anchorCol = -1;

  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (normalizeHeaderName(row[c]) === "response status list") {
        anchorRow = r;
        anchorCol = c;
        break;
      }
    }
    if (anchorRow !== -1) break;
  }

  if (anchorRow === -1 || anchorCol === -1) return [];

  const statuses: string[] = [];
  for (let r = anchorRow + 1; r < matrix.length; r++) {
    const value = String((matrix[r] ?? [])[anchorCol] ?? "").trim();
    if (!value) break;
    statuses.push(value);
  }

  return normalizeResponseStatusList(statuses);
}

type WorkbookParseResult = {
  applications: JobApplication[];
  preferredOrder: string[];
  missingResponseStatusColumn: boolean;
};

function parseWorkbook(wb: XLSX.WorkBook): WorkbookParseResult {
  const applicationsSheet = wb.Sheets["Applications"] ?? wb.Sheets[wb.SheetNames[0]];
  const listsSheet = wb.Sheets["Lists"];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(applicationsSheet, { defval: "" });
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(applicationsSheet, { header: 1, defval: "" });
  const headers = (matrix[0] ?? []).map((value) => normalizeHeaderName(value));
  const preferredOrder = extractResponseStatusOrderFromListSheet(listsSheet);
  const missingResponseStatusColumn = !headers.includes("response status");

  return {
    applications: mapRowsToApplications(rows),
    preferredOrder,
    missingResponseStatusColumn,
  };
}

function setPreferredResponseStatusOrder(order: string[]) {
  localStorage.setItem(RESPONSE_STATUS_ORDER_KEY, JSON.stringify(normalizeResponseStatusList(order)));
}

function setImportWarnings(warnings: string[]) {
  localStorage.setItem(IMPORT_WARNINGS_KEY, JSON.stringify(warnings));
}

export function consumeImportWarnings(): string[] {
  const raw = localStorage.getItem(IMPORT_WARNINGS_KEY);
  localStorage.removeItem(IMPORT_WARNINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getPreferredResponseStatusOrder(): string[] {
  const raw = localStorage.getItem(RESPONSE_STATUS_ORDER_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? normalizeResponseStatusList(parsed) : [];
  } catch {
    return [];
  }
}

/// Functions below handle parsing and mapping of Excel data to our application's data model.
export async function loadSeedData(): Promise<JobApplication[]> {
  const resp = await fetch("/seed-data.xlsx");
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parsed = parseWorkbook(wb);
  setPreferredResponseStatusOrder(parsed.preferredOrder);
  return parsed.applications;
}

export async function importApplicationsFromFile(file: File): Promise<{ applications: JobApplication[]; warnings: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parsed = parseWorkbook(wb);

  setPreferredResponseStatusOrder(parsed.preferredOrder);
  const warnings = parsed.missingResponseStatusColumn
    ? ["Missing 'Response Status' column in 'Applications' sheet. Defaulting all response statuses to Applied."]
    : [];
  setImportWarnings(warnings);

  return { applications: parsed.applications, warnings };
}

// Maps raw Excel rows to our JobApplication data structure, applying necessary transformations and defaults.
function mapRowsToApplications(rows: Record<string, unknown>[]): JobApplication[] {
  return rows
    .filter((r) => getCellByHeader(r, ["Job Title"]) && String(getCellByHeader(r, ["Job Title"])).trim())
    .map((r) => ({
      id: generateId(),
      jobTitle: String(getCellByHeader(r, ["Job Title"]) || "").trim(),
      companyName: String(getCellByHeader(r, ["Company Name"]) || "").trim(),
      location: String(getCellByHeader(r, ["Location"]) || "").trim(),
      currentStatus: mapStatus(getCellByHeader(r, ["Current Status"])),
      responseStatus: mapResponseStatus(getCellByHeader(r, ["Response Status"])),
      followUps: String(getCellByHeader(r, ["Follow Ups"]) || "").toLowerCase() === "yes",
      dateApplied: parseExcelDate(getCellByHeader(r, ["Date Applied"])),
      notes: String(getCellByHeader(r, ["Notes"]) || "").trim(),
      followUpDate: parseExcelDate(getCellByHeader(r, ["Follow-Up Date", "Follow Up Date"])),
      activityLog: [],
    }));
}

export function getApplications(): JobApplication[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as JobApplication[];
  return parsed.map((app) => ({
    ...app,
    currentStatus: mapStatus(app.currentStatus),
    responseStatus: mapResponseStatus(app.responseStatus),
  }));
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
