import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { importApplicationsFromFile, mapRowsToApplications, mapRowsToApplicationsWithValidation } from "@/lib/storage";

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
  });
});
