import { describe, expect, it } from "vitest";
import { getCompanyLogoSource, getCompanyLogoUrl, resolveCompanyDomain } from "@/lib/companyLogos";

describe("company logo resolution", () => {
  it("uses the curated employer domain before a job-posting URL", () => {
    // Curated matches prevent a known company from inheriting an unrelated posting-site brand.
    expect(resolveCompanyDomain("Publicis Groupe", "https://jobs.lever.co/example/123")).toBe("publicisgroupe.com");
    expect(getCompanyLogoUrl("Publicis Groupe")).toContain("domain=publicisgroupe.com");
  });

  it("accepts direct employer posting hosts", () => {
    expect(resolveCompanyDomain("Example Employer", "https://careers.example.com/jobs/123")).toBe("careers.example.com");
  });

  it("uses exact local assets for Alberta Government and Mariner name variants", () => {
    // Local overrides must win even when an application links to a misleading or generic posting host.
    expect(getCompanyLogoSource("Gov't of Alberta", "https://jobpostings.alberta.ca/job/123")).toEqual({
      src: "/company-logos/alberta-government.png",
      presentation: "wordmark",
    });
    expect(getCompanyLogoUrl("Government of Alberta")).toBe("/company-logos/alberta-government.png");
    expect(getCompanyLogoUrl("Mariner")).toBe("/company-logos/mariner-innovations.png");
    expect(getCompanyLogoUrl("Mariner Innovations")).toBe("/company-logos/mariner-innovations.png");
  });

  it("rejects ATS and malformed links when no trusted employer domain exists", () => {
    expect(resolveCompanyDomain("Example Employer", "https://boards.greenhouse.io/example/jobs/123")).toBeNull();
    expect(resolveCompanyDomain("Example Employer", "not a url")).toBeNull();
  });
});
