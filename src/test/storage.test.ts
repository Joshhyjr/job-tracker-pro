import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import type { JobApplication } from "@/lib/types";
import {
  addApplication,
  createImportBackup,
  generateId,
  getApplications,
  getLastImportMetadata,
  getLatestImportBackup,
  importApplicationsFromFile,
  mapRowsToApplications,
  mapRowsToApplicationsWithValidation,
  markSeeded,
  saveApplications,
  saveLastImportMetadata,
  updateApplication,
} from "@/lib/storage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("generateId", () => {
  it("prefers randomUUID when Web Crypto provides it", () => {
    const randomUuid = "11111111-2222-4333-8444-555555555555";
    vi.stubGlobal("crypto", { randomUUID: () => randomUuid, getRandomValues: vi.fn() });

    // Native UUID generation is the strongest and simplest browser path.
    expect(generateId()).toBe(randomUuid);
  });

  it("uses getRandomValues as a UUID-compatible fallback", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });

    // The fallback keeps 122 random bits and stamps the standard UUID version and variant bits.
    expect(generateId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("fails closed when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    // Predictable Math.random/time identifiers must never silently replace secure entropy.
    expect(() => generateId()).toThrow("requires Web Crypto");
  });
});

describe("mapRowsToApplications", () => {
  it("preserves an exported stable application ID", () => {
    const [application] = mapRowsToApplications([{
      "Application ID": "stable-application-id",
      "Job Title": "Platform Engineer",
      Company: "IBM",
    }]);

    // Stable IDs make exact-record workbook updates possible without relying on composite matching.
    expect(application.id).toBe("stable-application-id");
  });

  it("preserves a normalized company foreign key from an exported workbook", () => {
    const [application] = mapRowsToApplications([{
      "Application ID": "stable-application-id",
      "Company ID": "ibm",
      "Job Title": "Platform Engineer",
      Company: "International Business Machines",
    }]);

    // Company ID is authoritative and restores the canonical display name and official logo during import.
    expect(application).toMatchObject({
      companyId: "ibm",
      companyName: "IBM",
      companyDomain: "ibm.com",
      companyLogoUrl: "https://www.ibm.com/design/language/2285fa814297ab5eb0ffa21d2ee009db/ibm.svg",
    });
  });

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

  it("drops non-HTTP(S) job links from imported rows", () => {
    const applications = mapRowsToApplications([
      { "Job Title": "Unsafe Script Link", Company: "Acme", "Job Link": "javascript:alert(1)" },
      { "Job Title": "Unsafe Data Link", Company: "Beacon", "Job Link": "data:text/html,<script>alert(1)</script>" },
      { "Job Title": "Safe Link", Company: "Northstar", "Job Link": "https://jobs.example/safe" },
    ]);

    // Workbook links are untrusted and must cross the same absolute HTTP(S) boundary as app edits.
    expect(applications[0]).not.toHaveProperty("jobLink");
    expect(applications[1]).not.toHaveProperty("jobLink");
    expect(applications[2].jobLink).toBe("https://jobs.example/safe");
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

  it("imports and enriches reusable company branding fields", () => {
    const [application] = mapRowsToApplications([{
      Employer: "Example Employer",
      Position: "Platform Engineer",
      "Company Website": "https://www.example.com/about",
      "Company Logo URL": "https://assets.example.com/example.svg",
    }]);

    // Import enrichment normalizes the domain while preserving the stored logo as the first rendering source.
    expect(application).toMatchObject({
      companyDomain: "example.com",
      companyLogoUrl: "https://assets.example.com/example.svg",
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

  it("rejects legacy XLS and unrelated document formats", async () => {
    const legacyWorkbook = new File(["legacy workbook"], "applications.xls", { type: "application/vnd.ms-excel" });
    const document = new File(["document"], "applications.pdf", { type: "application/pdf" });

    // Extension validation happens before workbook parsing, producing a consistent actionable error.
    await expect(importApplicationsFromFile(legacyWorkbook)).rejects.toThrow("Only .xlsx Excel workbooks are supported.");
    await expect(importApplicationsFromFile(document)).rejects.toThrow("Only .xlsx Excel workbooks are supported.");
  });

  it("parses an import preview without changing persisted import metadata", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Applications");
    worksheet.addRow(["Company", "Job Title", "Date Applied"]);
    worksheet.addRow(["Apple", "Platform Engineer", "2026-08-05"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const file = new File([buffer], "preview.xlsx");

    await importApplicationsFromFile(file, { persistMetadata: false });

    // Cancelling the later dialog must not leave a misleading last-import breadcrumb.
    expect(getLastImportMetadata()).toBeNull();
  });
});

describe("import backups", () => {
  it("creates a restorable snapshot before a merge", () => {
    const current = mapRowsToApplications([{ "Job Title": "Platform Engineer", Company: "IBM", "Date Applied": "2026-08-01" }]);
    current[0].createdAt = "2026-08-01T10:00:00.000Z";

    const backup = createImportBackup(current, "new-jobs.xlsx");

    // The latest snapshot retains the full pre-import dataset and source workbook context.
    expect(getLatestImportBackup()).toEqual(backup);
    expect(backup).toMatchObject({
      sourceFileName: "new-jobs.xlsx",
      scope: "full",
      applications: [{ companyName: "IBM", createdAt: "2026-08-01T10:00:00.000Z" }],
    });
  });

  it("isolates signed-in browser backups by owner UID", () => {
    const first = createImportBackup(mapRowsToApplications([{ "Job Title": "Engineer", Company: "IBM" }]), "first.xlsx", "owner", "changes", "owner-1");
    const second = createImportBackup(mapRowsToApplications([{ "Job Title": "Designer", Company: "Apple" }]), "second.xlsx", "owner", "changes", "owner-2");

    // Shared devices must retain separate recovery points for different authenticated accounts.
    expect(getLatestImportBackup("owner", "owner-1")).toEqual(first);
    expect(getLatestImportBackup("owner", "owner-2")).toEqual(second);
  });

  it("blocks the merge boundary when a browser backup cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage quota exceeded");
    });

    // A swallowed localStorage failure is promoted to an actionable import failure after verification.
    expect(() => createImportBackup([], "new-jobs.xlsx")).toThrow("Could not create the automatic import backup");
  });

  it("treats legacy browser snapshots as full backups", () => {
    const current = mapRowsToApplications([{ "Job Title": "Platform Engineer", Company: "IBM" }]);
    localStorage.setItem("job-tracker-latest-import-backup", JSON.stringify({
      id: "legacy-backup",
      createdAt: "2026-08-01T10:00:00.000Z",
      sourceFileName: "legacy.xlsx",
      applications: current,
    }));

    // Backups created before scoped merge recovery must remain distinguishable and restorable after upgrade.
    expect(getLatestImportBackup()).toMatchObject({ id: "legacy-backup", scope: "full", applications: current });
  });
});

describe("getApplications", () => {
  it("returns an empty list when browser storage blocks reads", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    // Some browsers deny storage access entirely; boot should still recover with an empty dataset.
    expect(getApplications()).toEqual([]);
  });

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

  it("removes rejected URL fields from local updates without dropping unrelated data", () => {
    const created = addApplication({
      jobTitle: "Security Engineer",
      companyName: "Northstar",
      location: "Remote",
      currentStatus: "Applied",
      responseStatus: "Applied",
      followUps: false,
      dateApplied: "2026-08-10",
      notes: "Keep this note",
      followUpDate: "",
      jobLink: "https://jobs.example/security",
      companyLogoUrl: "https://cdn.example/logo.png",
      salary: "$130k",
      customFields: { Portfolio: "Keep this field" },
    });

    updateApplication({
      ...created,
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T11:00:00.000Z",
      jobLink: "data:text/html,<script>alert(1)</script>",
      companyLogoUrl: "javascript:alert(1)",
      salary: "$135k",
      customFields: { Portfolio: "Still present" },
    });

    const [stored] = JSON.parse(localStorage.getItem("job-tracker-data") || "[]") as JobApplication[];
    // Inspect the raw durable value so a later read-time sanitizer cannot hide an unsafe update write.
    expect(stored).not.toHaveProperty("jobLink");
    expect(stored).not.toHaveProperty("companyLogoUrl");
    expect(stored).toMatchObject({
      salary: "$135k",
      customFields: { Portfolio: "Still present" },
      createdAt: "2026-08-10T10:00:00.000Z",
      updatedAt: "2026-08-10T11:00:00.000Z",
      notes: "Keep this note",
    });
  });

  it("preserves structured status history when applications are reloaded", () => {
    saveApplications([{
      id: "app-history",
      jobTitle: "Marine Engineer",
      companyName: "Mariner",
      location: "Halifax",
      currentStatus: "Applied",
      responseStatus: "On Hold",
      followUps: false,
      dateApplied: "2026-07-01",
      notes: "",
      followUpDate: "",
      activityLog: [{
        id: "status-entry",
        date: "2026-07-13T12:00:00.000Z",
        type: "status_change",
        message: "Status changed from Interview to On Hold",
        fromStatus: "Interview",
        toStatus: "On Hold",
      }],
    }]);

    // A storage round trip must not strip the endpoints used by the dedicated status-history timeline.
    expect(getApplications()[0].activityLog[0]).toMatchObject({
      fromStatus: "Interview",
      toStatus: "On Hold",
    });
  });

  it("does not throw when browser storage rejects application writes", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    // Restricted/private browser contexts can deny writes; creating records should still succeed in memory.
    expect(() => saveApplications([])).not.toThrow();
    expect(() => markSeeded()).not.toThrow();
    expect(() => addApplication({
      jobTitle: "Platform Engineer",
      companyName: "Northstar",
      location: "Remote",
      currentStatus: "Applied",
      responseStatus: "Applied",
      followUps: false,
      dateApplied: "2026-06-01",
      notes: "",
      followUpDate: "",
    })).not.toThrow();

    setItemSpy.mockRestore();
  });

  it("does not throw when browser storage rejects import metadata writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    // Import success should not be reclassified as a fatal error just because metadata persistence is unavailable.
    expect(() => saveLastImportMetadata({
      fileName: "import.xlsx",
      importedAt: "2026-06-19T00:00:00.000Z",
      rowCount: 3,
      warningCount: 1,
    })).not.toThrow();
  });

  it("treats blocked seeded-flag reads as an unseeded workspace", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => {
      if (key === "job-tracker-seeded") throw new Error("storage blocked");
      return null;
    });

    const { loadInitialApplications } = await import("@/hooks/useApplications");
    await expect(loadInitialApplications()).resolves.toEqual([]);
  });
});
