import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

function getHeader(name: string): string | undefined {
  return vercelConfig.headers
    .flatMap((route) => route.headers)
    .find((header) => header.key.toLowerCase() === name.toLowerCase())?.value;
}

describe("Vercel content security policy", () => {
  it("keeps the production browser-hardening header baseline", () => {
    // These assertions prevent a config refactor from silently dropping independent browser defenses.
    expect(getHeader("X-Content-Type-Options")).toBe("nosniff");
    expect(getHeader("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(getHeader("Permissions-Policy")).toContain("camera=()");
  });

  it("allows the resources required by the production map and company logos", () => {
    // Keep production headers aligned with MapLibre and the single normalized favicon provider.
    const contentSecurityPolicy = getHeader("Content-Security-Policy");

    expect(contentSecurityPolicy).toContain("worker-src 'self' blob:");
    expect(contentSecurityPolicy).toContain("child-src blob:");
    expect(contentSecurityPolicy).toContain("img-src 'self' data: blob:");
    expect(contentSecurityPolicy).toContain("https://www.google.com");
    expect(contentSecurityPolicy).toContain("connect-src 'self' https://*.googleapis.com https://cloudflareinsights.com https://tiles.openfreemap.org");
    // Restrict future form submissions without changing the existing Firebase and map resource allowances.
    expect(contentSecurityPolicy).toContain("form-action 'self'");
  });

  it("keeps executable content and embedding policies fail-closed", () => {
    const contentSecurityPolicy = getHeader("Content-Security-Policy") ?? "";
    const scriptDirective = contentSecurityPolicy.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("script-src"));

    // Require the complete script allowlist so missing directives and broad scheme sources fail this regression test.
    expect(scriptDirective?.split(/\s+/)).toEqual([
      "script-src",
      "'self'",
      "https://apis.google.com",
      "https://www.gstatic.com",
      "https://static.cloudflareinsights.com",
    ]);
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("base-uri 'self'");
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
  });
});
