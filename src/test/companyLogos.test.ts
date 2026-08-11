import { beforeEach, describe, expect, it } from "vitest";
import {
  cacheSuccessfulCompanyLogo,
  enrichApplicationCompanyBranding,
  getCompanyFallbackStyle,
  getCompanyInitials,
  getCompanyLogoCandidates,
  getCompanyLogoSource,
  getCompanyLogoUrl,
  resolveCompanyDomain,
} from "@/lib/companyLogos";

beforeEach(() => {
  // Each resolver case starts without a learned source from a previous test.
  localStorage.clear();
});

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
      provider: "local",
    });
    expect(getCompanyLogoUrl("Government of Alberta")).toBe("/company-logos/alberta-government.png");
    expect(getCompanyLogoUrl("Mariner")).toBe("/company-logos/mariner-innovations.png");
    expect(getCompanyLogoUrl("Mariner Innovations")).toBe("/company-logos/mariner-innovations.png");
  });

  it("rejects ATS and malformed links when no trusted employer domain exists", () => {
    expect(resolveCompanyDomain("Example Employer", "https://boards.greenhouse.io/example/jobs/123")).toBeNull();
    expect(resolveCompanyDomain("Example Employer", "not a url")).toBeNull();
  });

  it("keeps canonical logos ahead of stale per-application URLs", () => {
    const [canonical, staleStored] = getCompanyLogoCandidates("Google", undefined, { companyLogoUrl: "https://assets.example/google.svg" });
    expect(canonical).toMatchObject({
      src: "https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg",
      provider: "stored",
    });
    expect(staleStored).toMatchObject({ src: "https://assets.example/google.svg", provider: "stored" });

    const [stored, fallback] = getCompanyLogoCandidates("Example Employer", undefined, {
      companyDomain: "example.com",
      companyLogoUrl: "https://assets.example/example.svg",
    });
    expect(stored).toMatchObject({ src: "https://assets.example/example.svg", provider: "stored" });

    // A confirmed fallback becomes the shared first source on later views without an application-level URL.
    cacheSuccessfulCompanyLogo("Example Employer", fallback, "example.com");
    expect(getCompanyLogoSource("Example Employer", undefined, { companyDomain: "example.com" })).toMatchObject({ src: fallback.src, provider: "cache" });
  });

  it("enriches imported records with reusable company branding", () => {
    const application = enrichApplicationCompanyBranding({
      companyName: "IBM",
      jobLink: "https://jobs.lever.co/ibm/role",
      companyDomain: undefined,
      companyLogoUrl: undefined,
    });

    // Curated identity beats the ATS host and persists a trusted official-domain URL for the import transaction.
    expect(application.companyDomain).toBe("ibm.com");
    expect(application.companyId).toBe("ibm");
    expect(application.companyLogoUrl).toBe("https://www.ibm.com/design/language/2285fa814297ab5eb0ffa21d2ee009db/ibm.svg");
  });

  it("migrates company aliases to one stable identity and current official logo", () => {
    const blackAndMcDonald = enrichApplicationCompanyBranding({
      companyName: "Black and MacDonald Limited",
      jobLink: undefined,
      companyDomain: undefined,
      companyLogoUrl: undefined,
    });
    const abm = enrichApplicationCompanyBranding({
      companyName: "ABM Industries",
      jobLink: undefined,
      companyDomain: undefined,
      companyLogoUrl: "https://assets.example/old-abm.png",
    });

    // Legacy spellings are migration inputs only; both records leave enrichment with canonical foreign keys.
    expect(blackAndMcDonald).toMatchObject({
      companyId: "black-and-mcdonald",
      companyName: "Black & McDonald",
      companyDomain: "blackandmcdonald.com",
      companyLogoUrl: "https://blackandmcdonald.com/wp-content/uploads/2020/05/BlackMcDonald_Logo.png",
    });
    expect(abm).toMatchObject({
      companyId: "abm",
      companyName: "ABM",
      companyLogoUrl: "https://cdn.prod.website-files.com/66450aa390462a415cd93051/66450aa390462a415cd930a2_logo--default.svg",
    });
  });

  it("repairs the exact demo aliases after an ATS favicon was previously cached", () => {
    const staleGlassdoorLogo = "https://www.google.com/s2/favicons?domain=glassdoor.ca&sz=64";
    const applications = [
      enrichApplicationCompanyBranding({
        companyId: "glassdoor-ca-legacy-abm",
        companyName: "ABM Integrated Solutions",
        jobLink: "https://www.glassdoor.ca/job-listing/example",
        companyDomain: "glassdoor.ca",
        companyLogoUrl: staleGlassdoorLogo,
      }),
      enrichApplicationCompanyBranding({
        companyId: "glassdoor-ca-legacy-black-mcdonald",
        companyName: "Black & McDonald Limited",
        jobLink: "https://www.glassdoor.ca/job-listing/example",
        companyDomain: "glassdoor.ca",
        companyLogoUrl: staleGlassdoorLogo,
      }),
    ];

    // The migration replaces only branding identity fields; application content is outside this helper's scope.
    expect(applications).toMatchObject([
      {
        companyId: "abm",
        companyName: "ABM",
        companyDomain: "abm.com",
        companyLogoUrl: "https://cdn.prod.website-files.com/66450aa390462a415cd93051/66450aa390462a415cd930a2_logo--default.svg",
      },
      {
        companyId: "black-and-mcdonald",
        companyName: "Black & McDonald",
        companyDomain: "blackandmcdonald.com",
        companyLogoUrl: "https://blackandmcdonald.com/wp-content/uploads/2020/05/BlackMcDonald_Logo.png",
      },
    ]);
  });

  it("rejects the Canadian Glassdoor host as a company domain", () => {
    // Country-specific recruiting hosts must never become an employer identity or favicon source.
    expect(resolveCompanyDomain("Unlisted Employer", "https://www.glassdoor.ca/job-listing/example")).toBeNull();
  });

  it("creates the requested acronym initials and deterministic fallback colors", () => {
    expect(getCompanyInitials("Google")).toBe("G");
    expect(getCompanyInitials("IBM")).toBe("IBM");
    expect(getCompanyInitials("FAO")).toBe("FAO");
    expect(getCompanyInitials("Dwelly")).toBe("D");
    expect(getCompanyFallbackStyle("Dwelly")).toEqual(getCompanyFallbackStyle("Dwelly"));
    expect(getCompanyFallbackStyle("Dwelly")).not.toEqual(getCompanyFallbackStyle("Google"));
  });
});
