import { describe, expect, it } from "vitest";
import {
  sanitizeApplicationInput,
  sanitizeCssColor,
  sanitizeCssIdentifier,
  sanitizeExternalHttpUrl,
} from "@/lib/security";

describe("security helpers", () => {
  it("allows only absolute HTTP(S) external URLs", () => {
    // The shared boundary rejects executable and relative destinations while preserving normal job links.
    expect(sanitizeExternalHttpUrl(" https://jobs.example/roles/1 ")).toBe("https://jobs.example/roles/1");
    expect(sanitizeExternalHttpUrl("http://localhost:8080/job")).toBe("http://localhost:8080/job");
    expect(sanitizeExternalHttpUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeExternalHttpUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeExternalHttpUrl("/relative/job")).toBe("");
  });

  it("drops an unsafe job link before application persistence", () => {
    // Sanitization must remove the optional property rather than store an empty or executable URL.
    expect(sanitizeApplicationInput({ jobLink: "javascript:alert(document.domain)" })).not.toHaveProperty("jobLink");
    expect(sanitizeApplicationInput({ jobLink: "https://jobs.example/safe" })).toHaveProperty("jobLink", "https://jobs.example/safe");
  });

  it("constrains identifiers and colors used by generated chart CSS", () => {
    // CSS fragments are accepted only after identifier normalization and conservative color validation.
    expect(sanitizeCssIdentifier('Revenue"] { display: block; }')).toBe("revenue-display-block");
    expect(sanitizeCssIdentifier("   ", "chart")).toBe("chart");
    expect(sanitizeCssColor("hsl(var(--chart-1))")).toBe("hsl(var(--chart-1))");
    expect(sanitizeCssColor("#1a2b3c")).toBe("#1a2b3c");
    expect(sanitizeCssColor("red; } body { display: none")).toBe("");
    expect(sanitizeCssColor("url(https://attacker.example/pixel)")).toBe("");
  });
});
