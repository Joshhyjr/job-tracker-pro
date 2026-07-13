import { describe, expect, it } from "vitest";
import { EXTERNAL_LINK_REL, sanitizeCssIdentifier } from "@/lib/security";

describe("security helpers", () => {
  it("sanitizes css identifiers before they reach attribute selectors or variables", () => {
    expect(sanitizeCssIdentifier('Team Name"][data-bad="1')).toBe("team-name-data-bad-1");
    expect(sanitizeCssIdentifier("__Revenue Trend__")).toBe("__revenue-trend__");
  });

  it("falls back to a safe identifier when the source is empty", () => {
    expect(sanitizeCssIdentifier("   ", "chart")).toBe("chart");
  });

  it("uses noopener for external links opened in a new tab", () => {
    expect(EXTERNAL_LINK_REL).toBe("noopener noreferrer");
  });
});
