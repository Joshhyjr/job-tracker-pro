import ExcelJS from "exceljs";
import type { JobApplication } from "./types";

function toRows(apps: JobApplication[]) {
  return apps.map((a) => ({
    "Job Title": a.jobTitle,
    "Company Name": a.companyName,
    Location: a.location,
    "Current Status": a.currentStatus,
    "Response Status": a.responseStatus,
    "Follow Ups": a.followUps ? "Yes" : "No",
    "Date Applied": a.dateApplied,
    Notes: a.notes,
    "Follow-Up Date": a.followUpDate,
  }));
}

export function exportCSV(apps: JobApplication[]) {
  // CSV export avoids spreadsheet formulas and escapes cells before handing data to the browser download API.
  const rows = toRows(apps);
  const headers = Object.keys(rows[0] ?? {
    "Job Title": "",
    "Company Name": "",
    Location: "",
    "Current Status": "",
    "Response Status": "",
    "Follow Ups": "",
    "Date Applied": "",
    Notes: "",
    "Follow-Up Date": "",
  });
  const csv = [headers, ...rows.map((row) => headers.map((header) => row[header as keyof typeof row] ?? ""))]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(csv, "job-applications.csv", "text/csv");
}

export async function exportXLSX(apps: JobApplication[]) {
  // ExcelJS preserves XLSX export while avoiding the vulnerable xlsx dependency.
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Applications");
  const rows = toRows(apps);
  const headers = Object.keys(rows[0] ?? {
    "Job Title": "",
    "Company Name": "",
    Location: "",
    "Current Status": "",
    "Response Status": "",
    "Follow Ups": "",
    "Date Applied": "",
    Notes: "",
    "Follow-Up Date": "",
  });

  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(headers.map((header) => row[header as keyof typeof row] ?? "")));

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
