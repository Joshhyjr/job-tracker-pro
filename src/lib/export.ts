import ExcelJS from "exceljs";
import type { JobApplication } from "./types";

const SPREADSHEET_FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function neutralizeSpreadsheetFormula(value: unknown): unknown {
  // Office applications can execute formula-like CSV/XLSX cells, so force untrusted leading operators to plain text.
  const cell = value ?? "";
  return typeof cell === "string" && SPREADSHEET_FORMULA_PREFIX.test(cell) ? `'${cell}` : cell;
}

function toRows(apps: JobApplication[]) {
  return apps.map((a) => ({
    "Job Title": a.jobTitle,
    "Company Name": a.companyName,
    Location: a.location,
    City: a.city ?? "",
    "Province/Region": a.region ?? "",
    Country: a.country ?? "",
    Latitude: a.latitude ?? "",
    Longitude: a.longitude ?? "",
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
    // Re-export custom spreadsheet columns so flexible imports remain round-trippable.
    ...(a.customFields ?? {}),
  }));
}

function getExportHeaders(rows: ReturnType<typeof toRows>) {
  const headers = new Set<string>([
    "Job Title",
    "Company Name",
    "Location",
    "City",
    "Province/Region",
    "Country",
    "Latitude",
    "Longitude",
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
  ]);

  rows.forEach((row) => Object.keys(row).forEach((header) => headers.add(header)));
  return Array.from(headers);
}

export function exportCSV(apps: JobApplication[]) {
  // CSV export neutralizes spreadsheet formulas and escapes cells before handing data to the browser download API.
  const rows = toRows(apps);
  const headers = getExportHeaders(rows);
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header as keyof typeof row] ?? ""))]
    .map((row) => row.map((cell) => `"${String(neutralizeSpreadsheetFormula(cell)).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(csv, "job-applications.csv", "text/csv");
}

export async function exportXLSX(apps: JobApplication[]) {
  // ExcelJS preserves XLSX export while avoiding the vulnerable xlsx dependency.
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Applications");
  const rows = toRows(apps);
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
