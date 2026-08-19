import { describe, expect, it } from "vitest";
import { buildApplicationExportRows, neutralizeSpreadsheetFormula } from "@/lib/export";
import { mapRowsToApplicationsWithValidation } from "@/lib/storage";
import type { JobApplication } from "@/lib/types";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: overrides.id ?? "canonical-id",
    jobTitle: overrides.jobTitle ?? "Data Analyst",
    companyName: overrides.companyName ?? "Canonical Company",
    location: overrides.location ?? "Halifax, Canada",
    currentStatus: overrides.currentStatus ?? "Interview",
    responseStatus: overrides.responseStatus ?? "Interview",
    followUps: overrides.followUps ?? false,
    dateApplied: overrides.dateApplied ?? "2026-08-19",
    notes: overrides.notes ?? "",
    followUpDate: overrides.followUpDate ?? "",
    customFields: overrides.customFields,
    activityLog: overrides.activityLog ?? [],
  };
}

describe("neutralizeSpreadsheetFormula", () => {
  it("forces formula-like spreadsheet cells to plain text", () => {
    // Imported and manually entered fields must remain inert when a user opens an exported spreadsheet.
    expect(neutralizeSpreadsheetFormula("=HYPERLINK(\"https://attacker.example\")")).toBe("'=HYPERLINK(\"https://attacker.example\")");
    expect(neutralizeSpreadsheetFormula("+SUM(1,1)")).toBe("'+SUM(1,1)");
    expect(neutralizeSpreadsheetFormula("-1+2")).toBe("'-1+2");
    expect(neutralizeSpreadsheetFormula("@SUM(1,1)")).toBe("'@SUM(1,1)");
    expect(neutralizeSpreadsheetFormula("\t=cmd")).toBe("'\t=cmd");
  });

  it("preserves ordinary strings and non-string values", () => {
    expect(neutralizeSpreadsheetFormula("Security Engineer")).toBe("Security Engineer");
    expect(neutralizeSpreadsheetFormula(42)).toBe(42);
    expect(neutralizeSpreadsheetFormula(false)).toBe(false);
  });
});

describe("application export rows", () => {
  it("protects canonical fields from colliding custom spreadsheet headers", () => {
    const [row] = buildApplicationExportRows([
      application({
        customFields: {
          "Application ID": "wrong-custom-id",
          "Custom: Application ID": "existing custom value",
          "Company Name": "Wrong Custom Company",
          "Response Status": "Rejected",
          Portfolio: "https://portfolio.example",
        },
      }),
    ]);

    // CSV and XLSX share these rows, so canonical values must win before either serializer runs.
    expect(row).toMatchObject({
      "Application ID": "canonical-id",
      "Company Name": "Canonical Company",
      "Response Status": "Interview",
      "Custom: Application ID": "existing custom value",
      "Custom: Application ID (2)": "wrong-custom-id",
      "Custom: Company Name": "Wrong Custom Company",
      "Custom: Response Status": "Rejected",
      Portfolio: "https://portfolio.example",
    });
  });

  it("preserves canonical identity and stable custom headers through export and re-import", () => {
    const rows = buildApplicationExportRows([
      application({
        id: "canonical-a",
        companyName: "Company A",
        customFields: {
          "Application ID": "wrong-custom-a",
          "Custom: Application ID": "existing custom value",
        },
      }),
      application({
        id: "canonical-b",
        companyName: "Company B",
        customFields: {
          "Application ID": "wrong-custom-b",
          Portfolio: "Keep this field",
        },
      }),
    ]);

    const result = mapRowsToApplicationsWithValidation(rows);

    // Every row uses the same renamed header, so heterogeneous records cannot conflate two custom fields.
    expect(rows[0]).toMatchObject({ "Custom: Application ID": "existing custom value", "Custom: Application ID (2)": "wrong-custom-a" });
    expect(rows[1]).toMatchObject({ "Custom: Application ID (2)": "wrong-custom-b" });
    expect(result.applications).toHaveLength(2);
    expect(result.applications[0]).toMatchObject({
      id: "canonical-a",
      companyName: "Company A",
      customFields: {
        "Custom: Application ID": "existing custom value",
        "Custom: Application ID (2)": "wrong-custom-a",
      },
    });
    expect(result.applications[1]).toMatchObject({
      id: "canonical-b",
      companyName: "Company B",
      customFields: {
        "Custom: Application ID (2)": "wrong-custom-b",
        Portfolio: "Keep this field",
      },
    });
  });
});
