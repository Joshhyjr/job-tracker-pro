import { describe, expect, it } from "vitest";
import { mapRowsToApplications } from "@/lib/storage";

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
});
