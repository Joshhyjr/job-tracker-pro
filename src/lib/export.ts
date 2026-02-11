import * as XLSX from "xlsx";
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
  const ws = XLSX.utils.json_to_sheet(toRows(apps));
  const csv = XLSX.utils.sheet_to_csv(ws);
  download(csv, "job-applications.csv", "text/csv");
}

export function exportXLSX(apps: JobApplication[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(toRows(apps));
  XLSX.utils.book_append_sheet(wb, ws, "Applications");
  XLSX.writeFile(wb, "job-applications.xlsx");
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
