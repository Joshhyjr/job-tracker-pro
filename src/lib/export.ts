import type { JobApplication } from "./types";
import { loadExcelJs } from "./exceljs";

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r]/;
const CANONICAL_EXPORT_HEADERS = [
  "Application ID",
  "Job Title",
  "Company Name",
  "Location",
  "City",
  "Province/Region",
  "Country",
  "Country Code",
  "Latitude",
  "Longitude",
  "Work Mode",
  "Location Status",
  "Current Status",
  "Response Status",
  "Follow Ups",
  "Date Applied",
  "Notes",
  "Follow-Up Date",
  "Job Link",
  "Salary",
  "Days Since Applied",
  "Cover Letter Included",
  "Recruiter/Contact Name",
  "Interview Date",
  "Tags",
] as const;
const CANONICAL_EXPORT_HEADER_SET = new Set<string>(CANONICAL_EXPORT_HEADERS);

export function neutralizeSpreadsheetFormula(value: unknown): unknown {
  // Office applications can execute formula-like CSV/XLSX cells, so force untrusted leading operators to plain text.
  const cell = value ?? "";
  return typeof cell === "string" && SPREADSHEET_FORMULA_PREFIX.test(cell) ? `'${cell}` : cell;
}

function buildCustomExportHeaderMap(apps: JobApplication[]): Map<string, string> {
  const headers = Array.from(new Set(apps.flatMap((application) => Object.keys(application.customFields ?? {}))));
  const usedHeaders = new Set<string>(CANONICAL_EXPORT_HEADERS);
  const exportHeaders = new Map<string, string>();

  // Reserve every already-safe header workbook-wide before assigning stable names to collisions.
  headers.filter((header) => !CANONICAL_EXPORT_HEADER_SET.has(header)).forEach((header) => {
    exportHeaders.set(header, header);
    usedHeaders.add(header);
  });
  headers.filter((header) => CANONICAL_EXPORT_HEADER_SET.has(header)).forEach((header) => {
    const baseHeader = `Custom: ${header}`;
    let exportHeader = baseHeader;
    let suffix = 2;
    while (usedHeaders.has(exportHeader)) exportHeader = `${baseHeader} (${suffix++})`;
    exportHeaders.set(header, exportHeader);
    usedHeaders.add(exportHeader);
  });

  return exportHeaders;
}

function buildCustomExportFields(customFields: JobApplication["customFields"], exportHeaders: Map<string, string>): Record<string, string> {
  const fields: Record<string, string> = {};
  Object.entries(customFields ?? {}).forEach(([header, value]) => {
    fields[exportHeaders.get(header) ?? header] = value;
  });
  return fields;
}

export function buildApplicationExportRows(apps: JobApplication[]) {
  const customExportHeaders = buildCustomExportHeaderMap(apps);
  return apps.map((a) => ({
    // Stable IDs let re-imports update the exact exported record without relying on fuzzy identity matching.
    "Application ID": a.id,
    "Job Title": a.jobTitle,
    "Company Name": a.companyName,
    Location: a.location,
    City: a.city ?? "",
    "Province/Region": a.region ?? "",
    Country: a.country ?? "",
    "Country Code": a.countryCode ?? "",
    Latitude: a.latitude ?? "",
    Longitude: a.longitude ?? "",
    "Work Mode": a.workMode ?? "",
    "Location Status": a.locationStatus ?? "",
    "Current Status": a.currentStatus,
    "Response Status": a.responseStatus,
    "Follow Ups": a.followUps ? "Yes" : "No",
    "Date Applied": a.dateApplied,
    Notes: a.notes,
    "Follow-Up Date": a.followUpDate,
    "Job Link": a.jobLink ?? "",
    Salary: a.salary ?? "",
    "Days Since Applied": a.daysSinceApplied ?? "",
    "Cover Letter Included": a.coverLetterIncluded == null ? "" : a.coverLetterIncluded ? "Yes" : "No",
    "Recruiter/Contact Name": a.recruiterContactName ?? "",
    "Interview Date": a.interviewDate ?? "",
    Tags: a.tags ?? "",
    // Workbook-wide collision-safe names preserve custom data without replacing canonical fields.
    ...buildCustomExportFields(a.customFields, customExportHeaders),
  }));
}

function getExportHeaders(rows: ReturnType<typeof buildApplicationExportRows>) {
  const headers = new Set<string>(CANONICAL_EXPORT_HEADERS);

  rows.forEach((row) => Object.keys(row).forEach((header) => headers.add(header)));
  return Array.from(headers);
}

export function exportCSV(apps: JobApplication[]) {
  // CSV export neutralizes spreadsheet formulas and escapes cells before handing data to the browser download API.
  const rows = buildApplicationExportRows(apps);
  const headers = getExportHeaders(rows);
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header as keyof typeof row] ?? ""))]
    .map((row) => row.map((cell) => `"${String(neutralizeSpreadsheetFormula(cell)).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(csv, "job-applications.csv", "text/csv");
}

export async function exportXLSX(apps: JobApplication[]) {
  // Load ExcelJS only when the user explicitly exports XLSX data so the main app bundle stays leaner.
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Applications");
  const rows = buildApplicationExportRows(apps);
  const headers = getExportHeaders(rows);

  worksheet.addRow(headers.map(neutralizeSpreadsheetFormula));
  rows.forEach((row) => worksheet.addRow(headers.map((header) => neutralizeSpreadsheetFormula(row[header as keyof typeof row]))));

  const buffer = await workbook.xlsx.writeBuffer();
  download(buffer, "job-applications.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function download(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
