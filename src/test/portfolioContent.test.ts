import {
  FALLBACK_PORTFOLIO_CONTENT,
  FALLBACK_PORTFOLIO_PROJECTS,
  formatPortfolioMonth,
  portfolioPageContentSchema,
  portfolioProjectsSchema,
  resolvePortfolioContent,
} from "@/lib/portfolioContent";

describe("portfolio content validation", () => {
  it("keeps the checked-in fallback content valid and ordered", () => {
    // The fallback must remain independently publishable when Firestore has no usable snapshot.
    const result = portfolioPageContentSchema.safeParse(FALLBACK_PORTFOLIO_CONTENT);
    expect(result.success).toBe(true);
    expect(FALLBACK_PORTFOLIO_PROJECTS.map((project) => project.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("rejects unsafe social links in otherwise valid page content", () => {
    const invalidContent = {
      ...FALLBACK_PORTFOLIO_CONTENT,
      profile: { ...FALLBACK_PORTFOLIO_CONTENT.profile, githubHref: "javascript:alert(1)" },
    };

    // Every editable external destination remains HTTPS-only before Firestore is called.
    expect(portfolioPageContentSchema.safeParse(invalidContent).success).toBe(false);
  });

  it("rejects impossible wall dates", () => {
    const invalidContent = {
      ...FALLBACK_PORTFOLIO_CONTENT,
      profile: { ...FALLBACK_PORTFOLIO_CONTENT.profile, wallDate: "2026-99-45T30:75" },
    };

    // The datetime input format alone is insufficient because impossible calendar values can match it.
    expect(portfolioPageContentSchema.safeParse(invalidContent).success).toBe(false);
  });

  it("rejects unsafe links and malformed project months", () => {
    const invalidProjects = [{
      ...FALLBACK_PORTFOLIO_PROJECTS[0],
      date: "August 2026",
      links: [{ label: "Unsafe", href: "javascript:alert(1)" }],
    }];

    // Client validation mirrors the high-value constraints enforced again by Firestore rules.
    expect(portfolioProjectsSchema.safeParse(invalidProjects).success).toBe(false);
  });

  it("formats stored year-month values without timezone drift", () => {
    expect(formatPortfolioMonth("2026-08")).toBe("Aug 2026");
  });

  it("restores project data retained from an incomplete Fast Refresh state", () => {
    const staleContent = { ...FALLBACK_PORTFOLIO_CONTENT, projects: undefined };

    // This reproduces the old-state/new-module boundary that previously reached CenterColumn.map.
    expect(resolvePortfolioContent(staleContent).projects).toEqual(FALLBACK_PORTFOLIO_PROJECTS);
    expect(resolvePortfolioContent(FALLBACK_PORTFOLIO_PROJECTS).projects).toEqual(FALLBACK_PORTFOLIO_PROJECTS);
  });
});
