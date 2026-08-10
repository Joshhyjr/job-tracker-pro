import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

describe("Vercel content security policy", () => {
  it("allows the resources required by the production map and company logos", () => {
    // Keep production headers aligned with MapLibre and the single normalized favicon provider.
    const contentSecurityPolicy = vercelConfig.headers
      .flatMap((route) => route.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;

    expect(contentSecurityPolicy).toContain("worker-src 'self' blob:");
    expect(contentSecurityPolicy).toContain("child-src blob:");
    expect(contentSecurityPolicy).toContain("img-src 'self' data: blob:");
    expect(contentSecurityPolicy).toContain("https://www.google.com");
    expect(contentSecurityPolicy).toContain("connect-src 'self' https://*.googleapis.com https://cloudflareinsights.com https://tiles.openfreemap.org");
    // Restrict future form submissions without changing the existing Firebase and map resource allowances.
    expect(contentSecurityPolicy).toContain("form-action 'self'");
  });
});
