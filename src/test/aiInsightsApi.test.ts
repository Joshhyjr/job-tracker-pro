import { describe, expect, it, vi } from "vitest";
import { handleAiInsightsRequest } from "../../api/ai-insights";
import { resetRateLimitState } from "../../api/_shared/security";
import { buildAiInsightSummary } from "@/lib/aiInsights";
import type { JobApplication } from "@/lib/types";

function createSummary() {
  const application: JobApplication = {
    id: "private-id",
    jobTitle: "Frontend Engineer",
    companyName: "Acme",
    location: "Remote",
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-06-01",
    followUpDate: "",
    notes: "Private note",
    recruiterContactName: "Private recruiter",
    customFields: { Secret: "Do not send" },
    activityLog: [],
  };
  return buildAiInsightSummary([application], new Date("2026-06-02T12:00:00Z"));
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://job-tracker.example/api/ai-insights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "job-tracker.example",
      // Default to a same-origin request so the endpoint's Origin check passes in tests.
      Origin: "https://job-tracker.example",
      Authorization: "Bearer test-access-token",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function geminiResponse(): Response {
  return Response.json({
    candidates: [{
      content: {
        parts: [{
          text: JSON.stringify({
            summary: "Your search is building momentum.",
            strengths: ["Consistent activity"],
            improvementAreas: ["Add follow-up dates"],
            recommendedNextActions: ["Follow up this week"],
          }),
        }],
      },
    }],
  });
}

describe("POST /api/ai-insights", () => {
  it("rate limits repeated requests from the same client ip", async () => {
    resetRateLimitState();

    const fetchMock = vi.fn().mockImplementation(async () => geminiResponse());
    const headers = { "x-forwarded-for": "203.0.113.10" };

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await handleAiInsightsRequest(request({ summary: createSummary() }, headers), {
        apiKey: "test-key",
        accessToken: "test-access-token",
        fetchImpl: fetchMock,
      });
      expect(response.status).toBe(200);
    }

    const throttled = await handleAiInsightsRequest(request({ summary: createSummary() }, headers), {
      apiKey: "test-key",
      accessToken: "test-access-token",
      fetchImpl: fetchMock,
    });

    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBeTruthy();
    await expect(throttled.json()).resolves.toMatchObject({
      error: "Too many requests. Please try again shortly.",
    });
  });

  it("rejects unsupported methods and cross-origin requests", async () => {
    resetRateLimitState();
    const getResponse = await handleAiInsightsRequest(new Request("https://job-tracker.example/api/ai-insights"));
    const crossOriginResponse = await handleAiInsightsRequest(request({ summary: createSummary() }, { Origin: "https://attacker.example" }));
    // Requests without an Origin header (curl/scripts) must also be rejected to prevent Gemini key abuse.
    const noOriginRequest = new Request("https://job-tracker.example/api/ai-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json", Host: "job-tracker.example", Authorization: "Bearer test-access-token" },
      body: JSON.stringify({ summary: createSummary() }),
    });
    const noOriginResponse = await handleAiInsightsRequest(noOriginRequest);
    const unauthenticatedResponse = await handleAiInsightsRequest(request({ summary: createSummary() }, { Authorization: "" }), { accessToken: "test-access-token" });

    expect(getResponse.status).toBe(405);
    expect(crossOriginResponse.status).toBe(403);
    expect(noOriginResponse.status).toBe(403);
    expect(unauthenticatedResponse.status).toBe(401);
  });

  it("rejects malformed payloads and missing configuration", async () => {
    resetRateLimitState();
    const invalidResponse = await handleAiInsightsRequest(request({ summary: { totalApplications: 1 } }), { apiKey: "test-key", accessToken: "test-access-token" });
    const missingKeyResponse = await handleAiInsightsRequest(request({ summary: createSummary() }), { apiKey: "", accessToken: "test-access-token" });

    expect(invalidResponse.status).toBe(400);
    expect(missingKeyResponse.status).toBe(503);
  });

  it("allows only summary fields through to Gemini and normalizes its response", async () => {
    resetRateLimitState();
    const fetchMock = vi.fn().mockImplementation(async () => geminiResponse());
    const response = await handleAiInsightsRequest(request({
      summary: {
        ...createSummary(),
        notes: "Private note must be removed",
        recruiterContactName: "Private recruiter must be removed",
      },
    }), {
      apiKey: "test-key",
      accessToken: "test-access-token",
      model: "gemini-test",
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      summary: "Your search is building momentum.",
      strengths: ["Consistent activity"],
      improvementAreas: ["Add follow-up dates"],
      recommendedNextActions: ["Follow up this week"],
    });

    const [url, options] = fetchMock.mock.calls[0];
    const providerBody = JSON.parse(options.body);
    expect(url).toContain("gemini-test");
    expect(providerBody.generationConfig.responseMimeType).toBe("application/json");
    expect(providerBody.generationConfig.responseSchema.required).toContain("recommendedNextActions");
    expect(JSON.stringify(providerBody)).not.toContain("Private note");
    expect(JSON.stringify(providerBody)).not.toContain("Private recruiter");
  });
});
