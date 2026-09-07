import type { JobApplication } from "./types";
import { loadExcelJs } from "./exceljs";

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r\n]/;

export function neutralizeSpreadsheetFormula(value: unknown): unknown {
  // Office applications can execute formula-like CSV/XLSX cells, so force untrusted leading operators to plain text.
  const cell = value ?? "";
  return typeof cell === "string" && SPREADSHEET_FORMULA_PREFIX.test(cell) ? `'${cell}` : cell;
}

function canonicalRows(apps: JobApplication[]) {
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
    "Role Fit": a.roleFit ? `${a.roleFit.charAt(0).toUpperCase()}${a.roleFit.slice(1)}` : "",
    "Tailored Resume": a.resumeTailored == null ? "" : a.resumeTailored ? "Yes" : "No",
    "Recruiter/Contact Name": a.recruiterContactName ?? "",
    "Interview Date": a.interviewDate ?? "",
    Tags: a.tags ?? "",
  }));
}

function getExportHeaders(rows: Array<Record<string, unknown>>) {
  const headers = new Set<string>([
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
    "Role Fit",
    "Tailored Resume",
    "Recruiter/Contact Name",
    "Interview Date",
    "Tags",
  ]);

  rows.forEach((row) => Object.keys(row).forEach((header) => headers.add(header)));
  return Array.from(headers);
}

export function buildApplicationExportRows(apps: JobApplication[]): Array<Record<string, unknown>> {
  const rows = canonicalRows(apps);
  const canonicalHeaders = new Set(getExportHeaders([]));
  const customHeaders = [...new Set(apps.flatMap((app) => Object.keys(app.customFields ?? {})))];
  // Reserve every original header before allocating aliases so different rows cannot reuse a renamed column.
  const usedHeaders = new Set([...canonicalHeaders, ...customHeaders]);
  const aliases = new Map(customHeaders.map((header) => {
    if (!canonicalHeaders.has(header)) return [header, header];
    const base = `Custom: ${header}`;
    let alias = base;
    let suffix = 2;
    while (usedHeaders.has(alias)) alias = `${base} (${suffix++})`;
    usedHeaders.add(alias);
    return [header, alias];
  }));
  return rows.map((row, index) => ({
    ...row,
    ...Object.fromEntries(Object.entries(apps[index].customFields ?? {}).map(([key, value]) => [aliases.get(key)!, value])),
  }));
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

  const activityWorksheet = workbook.addWorksheet("Activity History");
  const activityHeaders = ["Application ID", "Event ID", "Event Date", "Event Type", "From Status", "To Status", "Message"];
  activityWorksheet.addRow(activityHeaders);
  apps.forEach((application) => {
    application.activityLog.forEach((entry) => {
      // A separate event-grain sheet keeps every stage transition auditable after an XLSX backup.
      activityWorksheet.addRow([
        application.id,
        entry.id,
        entry.date,
        entry.type,
        entry.fromStatus ?? "",
        entry.toStatus ?? "",
        entry.message,
      ].map(neutralizeSpreadsheetFormula));
    });
  });

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
