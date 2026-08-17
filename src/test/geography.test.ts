import { describe, expect, it } from "vitest";
import { buildGeographySummary, normalizeCountryCode, parseJobLocation } from "@/lib/geography";
import type { JobApplication } from "@/lib/types";

function application(location: string, overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: overrides.id ?? location,
    jobTitle: "Analyst",
    companyName: "Acme",
    location,
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-08-01",
    notes: "",
    followUpDate: "",
    activityLog: [],
    ...overrides,
  };
}

describe("geography normalization", () => {
  it("normalizes country aliases to ISO 3166 alpha-2 codes", () => {
    expect(normalizeCountryCode("USA")).toBe("US");
    expect(normalizeCountryCode("U.S.")).toBe("US");
    expect(normalizeCountryCode("UK")).toBe("GB");
    expect(normalizeCountryCode("Switzerland")).toBe("CH");
    expect(normalizeCountryCode("Costa Rica")).toBe("CR");
  });

  it("separates Canadian cities, regions, countries, and work modes", () => {
    expect(parseJobLocation("Halifax, Nova Scotia, Canada")).toMatchObject({
      city: "Halifax",
      region: "Nova Scotia",
      country: "Canada",
      countryCode: "CA",
      locationStatus: "resolved",
    });
    expect(parseJobLocation("Toronto, ON")).toMatchObject({
      city: "Toronto",
      region: "Ontario",
      country: "Canada",
      countryCode: "CA",
    });
    const provinceOnly = parseJobLocation("Ontario, Canada");
    expect(provinceOnly).toMatchObject({
      region: "Ontario",
      countryCode: "CA",
    });
    expect(provinceOnly).not.toHaveProperty("city");
    expect(parseJobLocation("Halifax")).toMatchObject({
      city: "Halifax",
      region: "Nova Scotia",
      countryCode: "CA",
      latitude: 44.6488,
    });
  });

  it("never promotes work modes or ambiguous labels into geography", () => {
    expect(parseJobLocation("Remote")).toEqual({ workMode: "Remote", locationStatus: "work_mode_only" });
    expect(parseJobLocation("Remote - Americas")).toEqual({ workMode: "Remote", locationStatus: "work_mode_only" });
    expect(parseJobLocation("Unknown")).toEqual({ locationStatus: "needs_review" });
    expect(parseJobLocation("Springfield")).toEqual({ locationStatus: "needs_review" });
  });

  it("excludes Unknown from cities while retaining safely resolved country data", () => {
    const summary = buildGeographySummary([
      application("Unknown, Canada"),
      application("Toronto, Canada", { id: "toronto" }),
      application("Unknown", { id: "unknown-only" }),
    ]);

    // Unknown contributes to Canada only when the country is explicit; it never becomes a city or map marker.
    expect(summary.countries).toMatchObject([{ code: "CA", count: 2 }]);
    expect(summary.cities).toMatchObject([{ city: "Toronto", count: 1 }]);
    expect(summary.cities.some((city) => city.city === "Unknown")).toBe(false);
    expect(summary.needsReviewCount).toBe(1);
  });

  it("keeps country and city rankings at their correct geographic levels", () => {
    const summary = buildGeographySummary([
      application("Halifax, Canada"),
      application("Canada", { id: "country-only" }),
      application("Remote", { id: "remote" }),
    ]);

    expect(summary.countries).toMatchObject([{ code: "CA", name: "Canada", count: 2 }]);
    expect(summary.cities).toMatchObject([{ city: "Halifax", country: "Canada", count: 1 }]);
    expect(summary.remoteCount).toBe(1);
  });
});
