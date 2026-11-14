import { describe, expect, it } from "vitest";
import { getSiteKind, trackerUrl, portfolioUrl, resolvePortfolioLink } from "@/lib/siteDomains";

// Only exact production hosts participate in the split; previews retain both routes.
describe("site domains", () => {
  it("classifies production, development and previews", () => {
    expect(getSiteKind("jkivaria.com")).toBe("portfolio");
    expect(getSiteKind("www.jkivaria.com")).toBe("portfolio");
    expect(getSiteKind("job-tracker-pro-joshhyjr-s-projects.vercel.app")).toBe("tracker");
    expect(getSiteKind("localhost")).toBe("combined");
    expect(getSiteKind("job-tracker-preview.vercel.app")).toBe("combined");
    expect(getSiteKind("jkivaria.com.attacker.example")).toBe("combined");
  });
  it("preserves tracker deep links, queries and fragments", () => {
    expect(trackerUrl("/app/applications/123?q=test#notes", "www.jkivaria.com"))
      .toBe("https://job-tracker-pro-joshhyjr-s-projects.vercel.app/app/applications/123?q=test#notes");
    expect(trackerUrl("/app", "localhost")).toBe("/app");
    expect(portfolioUrl("job-tracker-pro-joshhyjr-s-projects.vercel.app")).toBe("https://www.jkivaria.com/");
  });
  it("resolves both published absolute and relative legacy project links", () => {
    expect(resolvePortfolioLink("https://www.jkivaria.com/app/analytics?x=1#top", "www.jkivaria.com"))
      .toBe(trackerUrl("/app/analytics?x=1#top", "www.jkivaria.com"));
    expect(resolvePortfolioLink("/app", "www.jkivaria.com")).toBe(trackerUrl("/app", "www.jkivaria.com"));
    expect(resolvePortfolioLink("https://github.com/Joshhyjr/harbor", "www.jkivaria.com")).toBe("https://github.com/Joshhyjr/harbor");
  });
});
