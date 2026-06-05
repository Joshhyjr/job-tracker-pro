import ExcelJS from "exceljs";
import type { JobApplication, CurrentStatus } from "./types";
import { mapResponseStatusToCurrentStatus, normalizeResponseStatus, normalizeResponseStatusList } from "./responseStatus";
import { sanitizeApplicationInput, sanitizeCurrentStatus, sanitizeDateInput, sanitizeMultilineText, sanitizeSingleLineText } from "./security";

const STORAGE_KEY = "job-tracker-data";
const SEEDED_KEY = "job-tracker-seeded";
const RESPONSE_STATUS_ORDER_KEY = "job-tracker-response-status-order";
const IMPORT_WARNINGS_KEY = "job-tracker-import-warnings";
const LAST_IMPORT_METADATA_KEY = "job-tracker-last-import";

type ImportField =
  | "jobTitle"
  | "companyName"
  | "location"
  | "city"
  | "region"
  | "country"
  | "latitude"
  | "longitude"
  | "currentStatus"
  | "responseStatus"
  | "followUps"
  | "dateApplied"
  | "notes"
  | "followUpDate"
  | "jobLink"
  | "salary"
  | "daysSinceApplied"
  | "coverLetterIncluded"
  | "recruiterContactName"
  | "interviewDate"
  | "tags";

type ColumnMapping = {
  byField: Partial<Record<ImportField, string>>;
  knownHeaders: Set<string>;
  warnings: string[];
};

type RowsParseResult = {
  applications: JobApplication[];
  warnings: string[];
};

export interface LastImportMetadata {
  fileName: string;
  importedAt: string;
  rowCount: number;
  warningCount: number;
}

const REQUIRED_IMPORT_FIELDS: ImportField[] = ["jobTitle", "companyName"];

const FIELD_LABELS: Record<ImportField, string> = {
  jobTitle: "Job Title",
  companyName: "Company",
  location: "Location",
  city: "City",
  region: "Province/Region",
  country: "Country",
  latitude: "Latitude",
  longitude: "Longitude",
  currentStatus: "Current Status",
  responseStatus: "Application Status",
  followUps: "Follow Ups",
  dateApplied: "Date Applied",
  notes: "Notes",
  followUpDate: "Follow-Up Date",
  jobLink: "Job Link",
  salary: "Salary",
  daysSinceApplied: "Days Since Applied",
  coverLetterIncluded: "Cover Letter Included",
  recruiterContactName: "Recruiter/Contact Name",
  interviewDate: "Interview Date",
  tags: "Tags",
};

// Header aliases let user-created templates keep their own language while mapping into stable app fields.
const FIELD_HEADER_ALIASES: Record<ImportField, string[]> = {
  jobTitle: ["Job Title", "Position", "Position Title", "Role", "Title", "Job Role", "Job Name", "Opening", "Opportunity"],
  companyName: ["Company Name", "Company", "Organization", "Organisation", "Employer", "Company/Employer", "Hiring Company"],
  location: ["Location", "Job Location", "Office Location", "Work Location"],
  city: ["City", "Job City", "Office City", "Location City"],
  region: ["Province/Region", "Province", "Region", "State", "Admin Region", "Administrative Region", "Location Region"],
  country: ["Country", "Job Country", "Office Country", "Location Country"],
  latitude: ["Latitude", "Lat"],
  longitude: ["Longitude", "Lng", "Long", "Lon"],
  currentStatus: ["Current Status", "Tracker Status", "Internal Status"],
  responseStatus: ["Response Status", "Decision Status", "Decision", "Outcome", "Application Status", "Status", "Stage"],
  followUps: ["Follow Ups", "Follow-Ups", "Follow Up", "Follow-Up", "Follow Up Needed", "Needs Follow Up"],
  dateApplied: ["Date Applied", "Application Date", "Applied Date", "Applied On", "Submission Date", "Submitted Date"],
  notes: ["Notes", "Comments", "Comment", "Application Notes", "Custom Notes"],
  followUpDate: ["Follow-Up Date", "Follow Up Date", "Follow-up Date", "Next Follow Up", "Follow Up On"],
  jobLink: ["Job Link", "Job URL", "Job Url", "Posting Link", "Application Link", "Posting URL", "URL", "Link"],
  salary: ["Salary", "Compensation", "Pay", "Salary Range", "Compensation Range", "Rate"],
  daysSinceApplied: ["Days Since Applied", "Days Applied", "Days Since Application", "Days Outstanding"],
  coverLetterIncluded: ["Cover Letter Included", "Cover Letter", "Cover Letter Sent", "Cover Letter Submitted"],
  recruiterContactName: ["Recruiter/Contact Name", "Recruiter", "Contact", "Contact Name", "Recruiter Name", "Hiring Manager"],
  interviewDate: ["Interview Date", "Next Interview", "Screen Date", "Phone Screen Date", "Interview Scheduled"],
  tags: ["Tags", "Tag", "Labels", "Custom Tags", "Notes/Tags", "Notes Tags", "Notes or Tags", "Custom Notes or Tags"],
};

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
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/['’"]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeadersFromRows(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const headers: string[] = [];

  rows.forEach((row) => {
    Object.keys(row).forEach((header) => {
      if (!header || seen.has(header)) return;
      seen.add(header);
      headers.push(header);
    });
  });

  return headers;
}

function createColumnMapping(headers: string[]): ColumnMapping {
  const aliases = new Map<string, ImportField>();
  (Object.entries(FIELD_HEADER_ALIASES) as [ImportField, string[]][]).forEach(([field, candidates]) => {
    candidates.forEach((candidate) => aliases.set(normalizeHeaderName(candidate), field));
  });

  const byField: Partial<Record<ImportField, string>> = {};
  const knownHeaders = new Set<string>();
  const warnings: string[] = [];

  headers.forEach((header) => {
    const normalizedHeader = normalizeHeaderName(header);
    if (!normalizedHeader) return;

    const field = aliases.get(normalizedHeader);
    if (!field) return;

    if (byField[field]) {
      warnings.push(`Column "${header}" also maps to ${FIELD_LABELS[field]}; using "${byField[field]}" and preserving "${header}" as a custom field.`);
      return;
    }

    byField[field] = header;
    knownHeaders.add(header);
  });

  return { byField, knownHeaders, warnings };
}

function getMappedCell(row: Record<string, unknown>, mapping: ColumnMapping, field: ImportField): unknown {
  const header = mapping.byField[field];
  return header ? row[header] : "";
}

function hasMeaningfulValue(value: unknown): boolean {
  return String(value ?? "").trim() !== "";
}

function isBlankRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => !hasMeaningfulValue(value));
}

function missingRequiredFields(row: Record<string, unknown>, mapping: ColumnMapping): ImportField[] {
  return REQUIRED_IMPORT_FIELDS.filter((field) => !hasMeaningfulValue(getMappedCell(row, mapping, field)));
}

function joinFieldLabels(fields: ImportField[]): string {
  return fields.map((field) => FIELD_LABELS[field]).join(", ");
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

function getCellHyperlinkTarget(value: ExcelJS.CellValue): string {
  if (value == null || value instanceof Date || typeof value !== "object") return "";
  // Excel stores hyperlink targets separately from display text, so link columns should prefer the target URL.
  if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink;
  return "";
}

function parseBooleanFlag(value: unknown): boolean | undefined {
  const normalized = normalizeHeaderName(value);
  if (!normalized) return undefined;
  if (["yes", "y", "true", "1", "included", "sent", "submitted"].includes(normalized)) return true;
  if (["no", "n", "false", "0", "not included", "none"].includes(normalized)) return false;
  return undefined;
}

function parseDaysSinceApplied(value: unknown): number | undefined {
  if (!hasMeaningfulValue(value)) return undefined;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseGeographicCoordinate(value: unknown, min: number, max: number): number | undefined {
  if (!hasMeaningfulValue(value)) return undefined;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function addTextField(application: JobApplication, key: "jobLink" | "salary" | "recruiterContactName" | "tags" | "city" | "country", value: unknown) {
  const sanitized = sanitizeSingleLineText(value, key === "jobLink" ? 2048 : undefined);
  if (sanitized) application[key] = sanitized;
}

function addDateField(application: JobApplication, key: "interviewDate", value: unknown) {
  const sanitized = sanitizeDateInput(parseExcelDate(value));
  if (sanitized) application[key] = sanitized;
}

function getCustomFields(row: Record<string, unknown>, mapping: ColumnMapping): Record<string, string> | undefined {
  const customFields: Record<string, string> = {};

  Object.entries(row).forEach(([header, value]) => {
    if (!header || mapping.knownHeaders.has(header) || !hasMeaningfulValue(value)) return;
    customFields[header] = sanitizeMultilineText(value);
  });

  return Object.keys(customFields).length > 0 ? customFields : undefined;
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
  const headers = Array.from({ length: sheet.columnCount }, (_, index) => String(getCellValue(sheet.getCell(1, index + 1).value) ?? ""));
  const linkHeader = createColumnMapping(headers).byField.jobLink;
  const rows: Record<string, unknown>[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const cellValue = row.getCell(index + 1).value;
      record[header] = header === linkHeader ? getCellHyperlinkTarget(cellValue) || getCellValue(cellValue) : getCellValue(cellValue);
    });
    rows.push(record);
  }

  return rows;
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
  warnings: string[];
};

function parseWorkbook(wb: ExcelJS.Workbook): WorkbookParseResult {
  const applicationsSheet = wb.getWorksheet("Applications") ?? wb.worksheets[0];
  // Empty workbooks cannot be mapped safely, so surface a clear import failure instead of a vague parser error.
  if (!applicationsSheet) throw new Error("Workbook does not contain any worksheets.");

  const listsSheet = wb.getWorksheet("Lists");
  const rows = worksheetToRows(applicationsSheet);
  const matrix = worksheetToMatrix(applicationsSheet);
  const headers = (matrix[0] ?? []).map((value) => String(value ?? ""));
  const mapping = createColumnMapping(headers);
  const parsedRows = mapRowsToApplicationsWithValidation(rows, headers);
  const preferredOrder = extractResponseStatusOrderFromListSheet(listsSheet);
  const missingResponseStatusColumn = !mapping.byField.responseStatus;

  return {
    applications: parsedRows.applications,
    preferredOrder,
    missingResponseStatusColumn,
    warnings: parsedRows.warnings,
  };
}

function setPreferredResponseStatusOrder(order: string[]) {
  localStorage.setItem(RESPONSE_STATUS_ORDER_KEY, JSON.stringify(normalizeResponseStatusList(order)));
}

function setImportWarnings(warnings: string[]) {
  localStorage.setItem(IMPORT_WARNINGS_KEY, JSON.stringify(warnings));
}

export function saveLastImportMetadata(metadata: LastImportMetadata) {
  // Keep a lightweight import breadcrumb without retaining the original workbook.
  localStorage.setItem(LAST_IMPORT_METADATA_KEY, JSON.stringify(metadata));
}

export function getLastImportMetadata(): LastImportMetadata | null {
  const raw = localStorage.getItem(LAST_IMPORT_METADATA_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastImportMetadata>;
    if (
      typeof parsed.fileName !== "string" ||
      typeof parsed.importedAt !== "string" ||
      typeof parsed.rowCount !== "number" ||
      typeof parsed.warningCount !== "number"
    ) {
      return null;
    }
    return {
      fileName: parsed.fileName,
      importedAt: parsed.importedAt,
      rowCount: parsed.rowCount,
      warningCount: parsed.warningCount,
    };
  } catch {
    return null;
  }
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
  warnings.push(...parsed.warnings);
  setImportWarnings(warnings);
  saveLastImportMetadata({
    fileName: sanitizeSingleLineText(file.name, 255) || "Imported workbook",
    importedAt: new Date().toISOString(),
    rowCount: parsed.applications.length,
    warningCount: warnings.length,
  });

  return { applications: parsed.applications, warnings };
}

export function mapRowsToApplicationsWithValidation(rows: Record<string, unknown>[], headers = getHeadersFromRows(rows)): RowsParseResult {
  const mapping = createColumnMapping(headers);
  const warnings = [...mapping.warnings];
  const missingColumns = REQUIRED_IMPORT_FIELDS.filter((field) => !mapping.byField[field]);

  if (missingColumns.length > 0) {
    warnings.push(`Missing required column(s): ${joinFieldLabels(missingColumns)}. Rows without those values were skipped.`);
  }

  const applications: JobApplication[] = [];

  rows.forEach((row, index) => {
    if (isBlankRow(row)) return;

    const missingFields = missingRequiredFields(row, mapping);
    if (missingFields.length > 0) {
      warnings.push(`Row ${index + 2} skipped because it is missing ${joinFieldLabels(missingFields)}.`);
      return;
    }

    const responseStatus = mapResponseStatus(getMappedCell(row, mapping, "responseStatus"));
    const rawCurrentStatus = getMappedCell(row, mapping, "currentStatus");
    const coverLetterIncluded = parseBooleanFlag(getMappedCell(row, mapping, "coverLetterIncluded"));
    const daysSinceApplied = parseDaysSinceApplied(getMappedCell(row, mapping, "daysSinceApplied"));
    const latitude = parseGeographicCoordinate(getMappedCell(row, mapping, "latitude"), -90, 90);
    const longitude = parseGeographicCoordinate(getMappedCell(row, mapping, "longitude"), -180, 180);
    const city = sanitizeSingleLineText(getMappedCell(row, mapping, "city"));
    const region = sanitizeSingleLineText(getMappedCell(row, mapping, "region"));
    const country = sanitizeSingleLineText(getMappedCell(row, mapping, "country"));
    const location = sanitizeSingleLineText(getMappedCell(row, mapping, "location")) || [city, region, country].filter(Boolean).join(", ");
    const customFields = getCustomFields(row, mapping);

    // Build the stable application shape first, then hydrate optional fields from flexible templates.
    const application: JobApplication = {
      id: generateId(),
      jobTitle: sanitizeSingleLineText(getMappedCell(row, mapping, "jobTitle")),
      companyName: sanitizeSingleLineText(getMappedCell(row, mapping, "companyName")),
      location,
      currentStatus: rawCurrentStatus ? mapStatus(rawCurrentStatus) : mapResponseStatusToCurrentStatus(responseStatus),
      responseStatus,
      followUps: parseBooleanFlag(getMappedCell(row, mapping, "followUps")) ?? false,
      dateApplied: sanitizeDateInput(parseExcelDate(getMappedCell(row, mapping, "dateApplied"))),
      notes: sanitizeMultilineText(getMappedCell(row, mapping, "notes")),
      followUpDate: sanitizeDateInput(parseExcelDate(getMappedCell(row, mapping, "followUpDate"))),
      activityLog: [],
    };

    addTextField(application, "jobLink", getMappedCell(row, mapping, "jobLink"));
    addTextField(application, "salary", getMappedCell(row, mapping, "salary"));
    addTextField(application, "recruiterContactName", getMappedCell(row, mapping, "recruiterContactName"));
    addTextField(application, "tags", getMappedCell(row, mapping, "tags"));
    addDateField(application, "interviewDate", getMappedCell(row, mapping, "interviewDate"));

    if (daysSinceApplied !== undefined) application.daysSinceApplied = daysSinceApplied;
    if (coverLetterIncluded !== undefined) application.coverLetterIncluded = coverLetterIncluded;
    // Parsed geography is optional enrichment; the legacy location string remains the table's source of truth.
    if (city) application.city = city;
    if (region) application.region = region;
    if (country) application.country = country;
    if (latitude !== undefined) application.latitude = latitude;
    if (longitude !== undefined) application.longitude = longitude;
    if (customFields) application.customFields = customFields;

    applications.push(application);
  });

  return { applications, warnings };
}

// Maps raw Excel rows to our JobApplication data structure, preserving the existing public helper signature.
export function mapRowsToApplications(rows: Record<string, unknown>[]): JobApplication[] {
  return mapRowsToApplicationsWithValidation(rows).applications;
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
