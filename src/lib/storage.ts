import ExcelJS from "exceljs";
import type { JobApplication, CurrentStatus } from "./types";
import { mapResponseStatusToCurrentStatus, normalizeResponseStatus, normalizeResponseStatusList } from "./responseStatus";
import { sanitizeApplicationInput, sanitizeCurrentStatus, sanitizeDateInput, sanitizeMultilineText, sanitizeSingleLineText } from "./security";

const STORAGE_KEY = "job-tracker-data";
const SEEDED_KEY = "job-tracker-seeded";
const RESPONSE_STATUS_ORDER_KEY = "job-tracker-response-status-order";
const IMPORT_WARNINGS_KEY = "job-tracker-import-warnings";

// Import aliases let existing trackers use their natural column names without losing status data.
const JOB_TITLE_HEADERS = ["Job Title", "Position", "Position Title", "Role", "Title"];
const COMPANY_HEADERS = ["Company Name", "Company", "Organization", "Employer"];
const LOCATION_HEADERS = ["Location", "Job Location"];
const CURRENT_STATUS_HEADERS = ["Current Status", "Status"];
const RESPONSE_STATUS_HEADERS = ["Response Status", "Decision Status", "Decision", "Outcome"];
const FOLLOW_UP_HEADERS = ["Follow Ups", "Follow-Ups", "Follow Up", "Follow-Up"];
const DATE_APPLIED_HEADERS = ["Date Applied", "Application Date", "Applied Date"];
const NOTES_HEADERS = ["Notes", "Comments"];
const FOLLOW_UP_DATE_HEADERS = ["Follow-Up Date", "Follow Up Date", "Follow-up Date"];

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

function parseExcelDate(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().split("T")[0];
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
    "pre-screen call": "Pre-screen call", "prescreen call": "Pre-screen call", "pre screen call": "Pre-screen call",
    applied: "Applied", interview: "Interview", offer: "Offer",
    rejected: "Rejected", "no response": "No Response", withdrawn: "Withdrawn",
  };
  return map[s.toLowerCase()] || "Applied";
}

// Maps raw value to a normalised response-status string
function mapResponseStatus(val: unknown): string {
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

function hasHeader(headers: string[], headerCandidates: string[]): boolean {
  return headerCandidates.some((candidate) => headers.includes(normalizeHeaderName(candidate)));
}

function getCellValue(value: ExcelJS.CellValue): unknown {
  // Excel cells can contain formulas, rich text, hyperlinks, or plain values; keep only displayable content.
  if (value == null) return "";
  if (value instanceof Date) return value;
  if (typeof value !== "object") return value;
  if ("result" in value) return getCellValue(value.result as ExcelJS.CellValue);
  if ("text" in value) return value.text;
  if ("richText" in value) return value.richText.map((part) => part.text).join("");
  if ("hyperlink" in value && "text" in value) return value.text;
  return "";
}

function worksheetToMatrix(sheet: ExcelJS.Worksheet): unknown[][] {
  const matrix: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = getCellValue(cell.value);
    });
    matrix.push(values);
  });
  return matrix;
}

function worksheetToRows(sheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const matrix = worksheetToMatrix(sheet);
  const headers = (matrix[0] ?? []).map((value) => String(value ?? ""));

  return matrix.slice(1).map((row) => {
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header) record[header] = row[index] ?? "";
    });
    return record;
  });
}

async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  // Keep spreadsheet parsing client-side without the vulnerable xlsx package.
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

function extractResponseStatusOrderFromListSheet(sheet?: ExcelJS.Worksheet): string[] {
  if (!sheet) return [];

  const matrix = worksheetToMatrix(sheet);
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

function parseWorkbook(wb: ExcelJS.Workbook): WorkbookParseResult {
  const applicationsSheet = wb.getWorksheet("Applications") ?? wb.worksheets[0];
  const listsSheet = wb.getWorksheet("Lists");
  const rows = worksheetToRows(applicationsSheet);
  const matrix = worksheetToMatrix(applicationsSheet);
  const headers = (matrix[0] ?? []).map((value) => normalizeHeaderName(value));
  const preferredOrder = extractResponseStatusOrderFromListSheet(listsSheet);
  const missingResponseStatusColumn = !hasHeader(headers, RESPONSE_STATUS_HEADERS);

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
  const wb = await loadWorkbook(buf);
  const parsed = parseWorkbook(wb);
  setPreferredResponseStatusOrder(parsed.preferredOrder);
  return parsed.applications;
}

export async function importApplicationsFromFile(file: File): Promise<{ applications: JobApplication[]; warnings: string[] }> {
  const buf = await file.arrayBuffer();
  const wb = await loadWorkbook(buf);
  const parsed = parseWorkbook(wb);

  setPreferredResponseStatusOrder(parsed.preferredOrder);
  const warnings = parsed.missingResponseStatusColumn
    ? ["Missing 'Response Status' column in 'Applications' sheet. Defaulting all response statuses to Applied."]
    : [];
  setImportWarnings(warnings);

  return { applications: parsed.applications, warnings };
}

// Maps raw Excel rows to our JobApplication data structure, applying necessary transformations and defaults.
export function mapRowsToApplications(rows: Record<string, unknown>[]): JobApplication[] {
  return rows
    .filter((r) => getCellByHeader(r, JOB_TITLE_HEADERS) && String(getCellByHeader(r, JOB_TITLE_HEADERS)).trim())
    .map((r) => {
      const responseStatus = mapResponseStatus(getCellByHeader(r, RESPONSE_STATUS_HEADERS));
      const rawCurrentStatus = getCellByHeader(r, CURRENT_STATUS_HEADERS);

      return {
        id: generateId(),
        jobTitle: sanitizeSingleLineText(getCellByHeader(r, JOB_TITLE_HEADERS)),
        companyName: sanitizeSingleLineText(getCellByHeader(r, COMPANY_HEADERS)),
        location: sanitizeSingleLineText(getCellByHeader(r, LOCATION_HEADERS)),
        currentStatus: rawCurrentStatus ? mapStatus(rawCurrentStatus) : mapResponseStatusToCurrentStatus(responseStatus),
        responseStatus,
        followUps: String(getCellByHeader(r, FOLLOW_UP_HEADERS) || "").toLowerCase() === "yes",
        dateApplied: sanitizeDateInput(parseExcelDate(getCellByHeader(r, DATE_APPLIED_HEADERS))),
        notes: sanitizeMultilineText(getCellByHeader(r, NOTES_HEADERS)),
        followUpDate: sanitizeDateInput(parseExcelDate(getCellByHeader(r, FOLLOW_UP_DATE_HEADERS))),
        activityLog: [],
      };
    });
}

export function getApplications(): JobApplication[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as JobApplication[];
  return parsed.map((app) => ({
    ...app,
    currentStatus: sanitizeCurrentStatus(mapStatus(app.currentStatus)),
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
  const newApp: JobApplication = { ...sanitizeApplicationInput(app), id: generateId(), activityLog: [{ id: generateId(), date: new Date().toISOString(), type: "note", message: "Application created" }] };
  const apps = getApplications();
  apps.unshift(newApp);
  saveApplications(apps);
  return newApp;
}

export function updateApplication(updated: JobApplication) {
  const apps = getApplications().map((a) => (a.id === updated.id ? { ...updated, ...sanitizeApplicationInput(updated) } : a));
  saveApplications(apps);
}

export function deleteApplication(id: string) {
  saveApplications(getApplications().filter((a) => a.id !== id));
}
