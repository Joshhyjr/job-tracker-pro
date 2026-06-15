import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { addApplication, getApplications, getLastImportMetadata, importApplicationsFromFile, mapRowsToApplications, mapRowsToApplicationsWithValidation } from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("mapRowsToApplications", () => {
  it("reads Decision Status as the imported response status", () => {
    const applications = mapRowsToApplications([
      {
        "Job Title": "Incident Response Analyst",
        "Company Name": "Cisco",
        Location: "Costa Rica",
        "Decision Status": "Rejected",
        "Follow Ups": "No",
        "Date Applied": 46027,
      },
      {
        "Job Title": "UX Intern",
        "Company Name": "Cisco",
        Location: "US",
        "Decision Status": "No response",
        "Follow Ups": "Yes",
        "Date Applied": "1/15/2026",
      },
    ]);

    expect(applications).toMatchObject([
      {
        jobTitle: "Incident Response Analyst",
        companyName: "Cisco",
        currentStatus: "Rejected",
        responseStatus: "Rejected",
        followUps: false,
        dateApplied: "2026-01-05",
      },
      {
        jobTitle: "UX Intern",
        currentStatus: "No Response",
        responseStatus: "No Response",
        followUps: true,
        dateApplied: "2026-01-15",
      },
    ]);
  });

  it("keeps cancelled roles out of the Applied bucket", () => {
    const [application] = mapRowsToApplications([
      {
        "Job Title": "Frontend Engineer",
        Company: "Acme",
        "Decision Status": "Role cancelled",
      },
    ]);

    expect(application.currentStatus).toBe("Withdrawn");
    expect(application.responseStatus).toBe("Role Cancelled");
  });

  it("sanitizes imported text fields before storage", () => {
    const [application] = mapRowsToApplications([
      {
        "Job Title": "  Security\u0000 Engineer  ",
        Company: "Acme\u0007 Corp",
        Notes: " Follow up after screen.\u0001 ",
        "Date Applied": "not-a-date",
      },
    ]);

    // Imported spreadsheets are untrusted input, so hidden control characters are stripped at the boundary.
    expect(application).toMatchObject({
      jobTitle: "Security Engineer",
      companyName: "Acme Corp",
      notes: "Follow up after screen.",
      dateApplied: "",
    });
  });

  it("maps headers with quote separators to the same fields as spaced headers", () => {
    const [application] = mapRowsToApplications([
      {
        Role: "Engineer",
        Organisation: "Acme",
        "Job'Link": "https://jobs.example/engineer",
      },
    ]);

    expect(application.jobLink).toBe("https://jobs.example/engineer");
  });

  it("maps user template synonyms and preserves unknown columns", () => {
    const [application] = mapRowsToApplications([
      {
        Organisation: "Northstar Labs",
        Role: "Frontend Platform Engineer",
        "Application Status": "Interview scheduled",
        "Applied On": "2/1/2026",
        "Job URL": "https://jobs.example/frontend",
        Compensation: "$120k - $140k",
        Recruiter: "Ari Patel",
        "Cover Letter Sent": "Yes",
        "Interview Date": "2/20/2026",
        Labels: "remote, react",
        "Portfolio Notes": "Sent case study link",
      },
    ]);

    // Unknown columns stay attached to the imported application instead of disappearing.
    expect(application).toMatchObject({
      jobTitle: "Frontend Platform Engineer",
      companyName: "Northstar Labs",
      currentStatus: "Interview",
      responseStatus: "Interview",
      dateApplied: "2026-02-01",
      jobLink: "https://jobs.example/frontend",
      salary: "$120k - $140k",
      recruiterContactName: "Ari Patel",
      coverLetterIncluded: true,
      interviewDate: "2026-02-20",
      tags: "remote, react",
      customFields: {
        "Portfolio Notes": "Sent case study link",
      },
    });
  });

  it("maps parsed geography fields without replacing the display location", () => {
    const [application] = mapRowsToApplications([
      {
        Position: "Platform Engineer",
        Employer: "Atlas",
        Location: "Remote - Americas",
        City: "Toronto",
        Country: "Canada",
        Latitude: "43.6532",
        Longitude: "-79.3832",
      },
    ]);

    // Geography enriches the map while the legacy Location value remains available to the table.
    expect(application).toMatchObject({
      location: "Remote - Americas",
      city: "Toronto",
      country: "Canada",
      latitude: 43.6532,
      longitude: -79.3832,
    });
  });

  it("maps province or region fields as location enrichment", () => {
    const [application] = mapRowsToApplications([
      {
        Position: "Systems Analyst",
        Employer: "Forvan Tech",
        City: "Woodstock",
        Province: "Ontario",
        Country: "Canada",
      },
    ]);

    expect(application).toMatchObject({
      location: "Woodstock, Ontario, Canada",
      city: "Woodstock",
      region: "Ontario",
      country: "Canada",
    });
  });

  it("preserves assessment and withdrawn tracker statuses from imported workbooks", () => {
    const applications = mapRowsToApplications([
      {
        Position: "Security Analyst",
        Employer: "Atlas",
        "Current Status": "Assessment",
      },
      {
        Position: "Support Engineer",
        Employer: "Beacon",
        "Current Status": "Withdrawn",
      },
    ]);

    expect(applications).toMatchObject([
      { currentStatus: "Assessment", responseStatus: "Applied" },
      { currentStatus: "Withdrawn", responseStatus: "Applied" },
    ]);
  });

  it("derives the display location from city and country when location is absent", () => {
    const [application] = mapRowsToApplications([
      {
        Position: "Backend Engineer",
        Employer: "Atlas",
        City: "Halifax",
        Country: "Canada",
      },
    ]);

    // City/Country-only templates still leave the existing table Location column populated.
    expect(application).toMatchObject({
      location: "Halifax, Canada",
      city: "Halifax",
      country: "Canada",
    });
  });

  it("returns validation warnings for rows missing required fields", () => {
    const result = mapRowsToApplicationsWithValidation([
      {
        Employer: "Acme",
        Status: "Applied",
      },
      {
        Position: "Backend Engineer",
        Status: "Applied",
      },
    ]);

    expect(result.applications).toEqual([]);
    expect(result.warnings).toEqual([
      "Row 2 skipped because it is missing Job Title.",
      "Row 3 skipped because it is missing Company.",
    ]);
  });

  it("imports an XLSX template with reordered columns and extra fields", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Applications");
    worksheet.addRow(["Salary", "Employer", "Position", "Custom Priority", "Cover Letter", "Follow-up Date", "Job Link"]);
    worksheet.addRow(["$90k", "Beacon Systems", "Security Analyst", "High", "No", "3/10/2026", { text: "Apply", hyperlink: "https://jobs.example/security-analyst" }]);

    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer], "custom-template.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const result = await importApplicationsFromFile(file);

    expect(result.applications).toHaveLength(1);
    expect(result.applications[0]).toMatchObject({
      jobTitle: "Security Analyst",
      companyName: "Beacon Systems",
      salary: "$90k",
      coverLetterIncluded: false,
      followUpDate: "2026-03-10",
      jobLink: "https://jobs.example/security-analyst",
      customFields: {
        "Custom Priority": "High",
      },
    });
    expect(result.warnings).toContain("Missing 'Response Status' column in 'Applications' sheet. Defaulting all response statuses to Applied.");
    // Import metadata helps the app resume from saved rows without keeping a copy of the XLSX file.
    expect(getLastImportMetadata()).toMatchObject({
      fileName: "custom-template.xlsx",
      rowCount: 1,
      warningCount: result.warnings.length,
    });
    expect(getLastImportMetadata()?.importedAt).toEqual(expect.any(String));
  });

  it("rejects workbooks that exceed the upload size limit", async () => {
    // The size check runs before ExcelJS expands attacker-controlled workbook data in browser memory.
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "oversized.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(importApplicationsFromFile(file)).rejects.toThrow("Workbook exceeds the 10 MB import limit.");
  });
});

describe("getApplications", () => {
  it("returns an empty list when stored JSON is corrupted", () => {
    // Browser extensions or manual localStorage edits should not crash the app shell on next boot.
    localStorage.setItem("job-tracker-data", "{not-json");

    expect(getApplications()).toEqual([]);
  });

  it("returns an empty list when stored data is not an array", () => {
    localStorage.setItem("job-tracker-data", JSON.stringify({ id: "unexpected-shape" }));

    expect(getApplications()).toEqual([]);
  });

  it("preserves optional application fields when creating a new record", () => {
    const created = addApplication({
      jobTitle: " Platform Engineer ",
      companyName: " Northstar ",
      location: " Remote ",
      currentStatus: "Applied",
      responseStatus: "Human reply received",
      followUps: true,
      dateApplied: "2026-06-01",
      notes: " First contact made ",
      followUpDate: "2026-06-10",
      city: " Halifax ",
      region: " Nova Scotia ",
      country: " Canada ",
      latitude: 44.6488,
      longitude: -63.5752,
      jobLink: " https://jobs.example/platform ",
      salary: " $130k ",
      daysSinceApplied: 14,
      coverLetterIncluded: true,
      recruiterContactName: " Alex Doe ",
      interviewDate: "2026-06-18",
      tags: " remote, platform ",
      customFields: {
        " Portfolio Notes ": " Shared case study ",
      },
    });

    // Newly created rows should retain enriched workbook-style fields for future UI features and exports.
    expect(created).toMatchObject({
      city: "Halifax",
      region: "Nova Scotia",
      country: "Canada",
      latitude: 44.6488,
      longitude: -63.5752,
      jobLink: "https://jobs.example/platform",
      salary: "$130k",
      daysSinceApplied: 14,
      coverLetterIncluded: true,
      recruiterContactName: "Alex Doe",
      interviewDate: "2026-06-18",
      tags: "remote, platform",
      customFields: {
        "Portfolio Notes": "Shared case study",
      },
    });
    expect(created.activityLog).toHaveLength(1);
    expect(getApplications()[0]).toMatchObject({
      city: "Halifax",
      jobLink: "https://jobs.example/platform",
      customFields: {
        "Portfolio Notes": "Shared case study",
      },
    });
  });
});
