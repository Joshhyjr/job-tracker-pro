import { describe, expect, it } from "vitest";
import { neutralizeSpreadsheetFormula } from "@/lib/export";

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
