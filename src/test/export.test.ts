import { describe, expect, it } from "vitest";
import { buildApplicationExportRows, neutralizeSpreadsheetFormula } from "@/lib/export";
import type { JobApplication } from "@/lib/types";

describe("neutralizeSpreadsheetFormula", () => {
  it("forces formula-like spreadsheet cells to plain text", () => {
    // Imported and manually entered fields must remain inert when a user opens an exported spreadsheet.
    expect(neutralizeSpreadsheetFormula("=HYPERLINK(\"https://attacker.example\")")).toBe("'=HYPERLINK(\"https://attacker.example\")");
    expect(neutralizeSpreadsheetFormula("+SUM(1,1)")).toBe("'+SUM(1,1)");
    expect(neutralizeSpreadsheetFormula("-1+2")).toBe("'-1+2");
    expect(neutralizeSpreadsheetFormula("@SUM(1,1)")).toBe("'@SUM(1,1)");
    expect(neutralizeSpreadsheetFormula("\t=cmd")).toBe("'\t=cmd");
    expect(neutralizeSpreadsheetFormula("\n=cmd")).toBe("'\n=cmd");
  });

  it("preserves ordinary strings and non-string values", () => {
    expect(neutralizeSpreadsheetFormula("Security Engineer")).toBe("Security Engineer");
    expect(neutralizeSpreadsheetFormula(42)).toBe(42);
    expect(neutralizeSpreadsheetFormula(false)).toBe(false);
  });
});

it("preserves canonical fields and allocates distinct custom headers across all rows", () => {
  const base: JobApplication = {
    id: "real-id", companyName: "Real company", jobTitle: "Analyst", location: "",
    currentStatus: "Applied", responseStatus: "Applied", dateApplied: "2026-09-05",
    followUps: false, followUpDate: "", notes: "", activityLog: [],
  };
  // A custom ID must not redirect re-imports; an existing prefixed header must retain its own value.
  const rows = buildApplicationExportRows([
    { ...base, customFields: { "Application ID": "custom-id", "Company Name": "custom-company" } },
    { ...base, id: "second-id", customFields: { "Custom: Application ID": "already-prefixed", "Application ID": "other-custom" } },
  ]);
  expect(rows[0]).toMatchObject({ "Application ID": "real-id", "Company Name": "Real company", "Custom: Application ID (2)": "custom-id", "Custom: Company Name": "custom-company" });
  expect(rows[1]).toMatchObject({ "Application ID": "second-id", "Custom: Application ID": "already-prefixed", "Custom: Application ID (2)": "other-custom" });
});
