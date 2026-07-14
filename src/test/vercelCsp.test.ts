import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json";

describe("Vercel content security policy", () => {
  it("allows the resources required by the production MapLibre map", () => {
    // Keep production headers aligned with MapLibre's worker/image CSP requirements and the chosen tile host.
    const contentSecurityPolicy = vercelConfig.headers
      .flatMap((route) => route.headers)
      .find((header) => header.key === "Content-Security-Policy")?.value;

    expect(contentSecurityPolicy).toContain("worker-src 'self' blob:");
    expect(contentSecurityPolicy).toContain("child-src blob:");
    expect(contentSecurityPolicy).toContain("img-src 'self' data: blob:");
    expect(contentSecurityPolicy).toContain("connect-src 'self' https://*.googleapis.com https://cloudflareinsights.com https://tiles.openfreemap.org");
  });
});
