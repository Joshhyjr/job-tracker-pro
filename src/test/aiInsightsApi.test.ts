import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAiInsightsRequest } from "../../api/ai-insights";
import { FirebaseAdminConfigurationError } from "../../api/_shared/firebaseAuth";
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
  return buildAiInsightSummary([application], new Date("2026-06-02T12:00:00Z"), {
    fileName: "private-client-workbook.xlsx",
    importedAt: "2026-06-02T12:00:00.000Z",
    rowCount: 1,
    warningCount: 0,
  });
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://job-tracker.example/api/ai-insights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "job-tracker.example",
      // Default to a same-origin request so the endpoint's Origin check passes in tests.
      Origin: "https://job-tracker.example",
      Authorization: "Bearer test-firebase-id-token",
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

async function verifyApprovedIdToken(idToken: string): Promise<boolean> {
  // API tests exercise the auth boundary without requiring real Firebase credentials or network calls.
  return idToken === "test-firebase-id-token";
}

describe("POST /api/ai-insights", () => {
  beforeEach(() => {
    // Each case starts with fresh buckets so rate-limit behavior remains deterministic.
    resetRateLimitState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rate limits repeated authenticated requests from the same client ip", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => geminiResponse());
    const headers = { "x-forwarded-for": "203.0.113.10" };
    const options = {
      apiKey: "test-key",
      verifyIdToken: verifyApprovedIdToken,
      fetchImpl: fetchMock,
    };

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await handleAiInsightsRequest(request({ summary: createSummary() }, headers), options);
      expect(response.status).toBe(200);
    }

    const throttled = await handleAiInsightsRequest(request({ summary: createSummary() }, headers), options);

    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBeTruthy();
    expect(throttled.headers.get("x-ratelimit-limit")).toBe("12");
    expect(throttled.headers.get("x-ratelimit-remaining")).toBe("0");
    await expect(throttled.json()).resolves.toEqual({ error: "Too many requests. Please try again shortly." });
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it("rate limits invalid token verification without consuming the owner bucket", async () => {
    const verifyIdToken = vi.fn().mockResolvedValue(false);
    const headers = { "x-vercel-forwarded-for": "203.0.113.44" };

    // The higher pre-auth allowance absorbs normal token refresh races while bounding verification abuse.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await handleAiInsightsRequest(request({ summary: createSummary() }, headers), { verifyIdToken });
      expect(response.status).toBe(403);
    }

    const throttled = await handleAiInsightsRequest(request({ summary: createSummary() }, headers), { verifyIdToken });
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("x-ratelimit-limit")).toBe("60");
    expect(verifyIdToken).toHaveBeenCalledTimes(60);
  });

  it("rejects unsupported methods and cross-origin requests", async () => {
    const getResponse = await handleAiInsightsRequest(new Request("https://job-tracker.example/api/ai-insights"));
    const crossOriginResponse = await handleAiInsightsRequest(request({ summary: createSummary() }, { Origin: "https://attacker.example" }));
    // Requests without an Origin header (curl/scripts) must also be rejected to prevent Gemini key abuse.
    const noOriginRequest = new Request("https://job-tracker.example/api/ai-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json", Host: "job-tracker.example", Authorization: "Bearer test-firebase-id-token" },
      body: JSON.stringify({ summary: createSummary() }),
    });
    const noOriginResponse = await handleAiInsightsRequest(noOriginRequest);
    const unauthenticatedResponse = await handleAiInsightsRequest(request({ summary: createSummary() }, { Authorization: "" }), { verifyIdToken: verifyApprovedIdToken });
    const wrongAccountResponse = await handleAiInsightsRequest(request({ summary: createSummary() }), { verifyIdToken: async () => false });

    expect(getResponse.status).toBe(405);
    expect(crossOriginResponse.status).toBe(403);
    expect(noOriginResponse.status).toBe(403);
    expect(unauthenticatedResponse.status).toBe(401);
    expect(wrongAccountResponse.status).toBe(403);
  });

  it("rejects malformed payloads and missing configuration", async () => {
    const invalidResponse = await handleAiInsightsRequest(request({ summary: { totalApplications: 1 } }), { apiKey: "test-key", verifyIdToken: verifyApprovedIdToken });
    const invalidContentTypeResponse = await handleAiInsightsRequest(
      request({ summary: createSummary() }, { "Content-Type": "application/jsonx" }),
      { apiKey: "test-key", verifyIdToken: verifyApprovedIdToken },
    );
    const missingKeyResponse = await handleAiInsightsRequest(request({ summary: createSummary() }), { apiKey: "", verifyIdToken: verifyApprovedIdToken });
    const missingAdminResponse = await handleAiInsightsRequest(request({ summary: createSummary() }), {
      verifyIdToken: async () => { throw new FirebaseAdminConfigurationError(); },
    });

    expect(invalidResponse.status).toBe(400);
    expect(invalidContentTypeResponse.status).toBe(415);
    expect(missingKeyResponse.status).toBe(503);
    expect(missingAdminResponse.status).toBe(503);
  });

  it("allows only summary fields through to Gemini and normalizes its response", async () => {
    const providerResponse = geminiResponse();
    const cancelProviderBody = vi.spyOn(providerResponse.body!, "cancel");
    const fetchMock = vi.fn().mockResolvedValue(providerResponse);
    const response = await handleAiInsightsRequest(request({
      summary: {
        ...createSummary(),
        notes: "Private note must be removed",
        recruiterContactName: "Private recruiter must be removed",
      },
    }, { "Content-Type": "application/json; charset=utf-8" }), {
      apiKey: "test-key",
      verifyIdToken: verifyApprovedIdToken,
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
    expect(JSON.stringify(providerBody)).not.toContain("private-client-workbook.xlsx");
    expect(JSON.stringify(providerBody)).not.toContain("2026-06-02T12:00:00.000Z");
    expect(JSON.stringify(providerBody)).not.toContain("Secret");
    expect(JSON.stringify(providerBody)).not.toContain("customFieldHeaders");
    expect(JSON.stringify(providerBody)).not.toContain("improvementSignals");
    // Successful Gemini content is consumed for parsing rather than discarded.
    expect(providerResponse.bodyUsed).toBe(true);
    expect(cancelProviderBody).not.toHaveBeenCalled();
  });

  it("logs only allowlisted provider correlation metadata", async () => {
    const privateProviderDetail = "private-provider-detail-must-not-enter-logs";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cancelProviderBody = vi.fn();
    const providerResponse = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(privateProviderDetail));
      },
      cancel: cancelProviderBody,
    }), {
      status: 400,
      headers: { "x-request-id": "gemini-request-123" },
    });
    const fetchMock = vi.fn().mockResolvedValue(providerResponse);

    const response = await handleAiInsightsRequest(request({ summary: createSummary() }), {
      apiKey: "test-key",
      model: "gemini-test",
      verifyIdToken: verifyApprovedIdToken,
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(502);
    expect(consoleError).toHaveBeenCalledWith("Gemini request failed", {
      model: "gemini-test",
      status: 400,
      requestId: "gemini-request-123",
    });
    expect(cancelProviderBody).toHaveBeenCalledOnce();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(privateProviderDetail);
  });

  it("cancels a failed primary response before trying the fallback model", async () => {
    const cancelPrimaryBody = vi.fn();
    const primaryResponse = new Response(new ReadableStream({ cancel: cancelPrimaryBody }), { status: 429 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(primaryResponse)
      .mockResolvedValueOnce(geminiResponse());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await handleAiInsightsRequest(request({ summary: createSummary() }), {
      apiKey: "test-key",
      model: "gemini-primary-test",
      verifyIdToken: verifyApprovedIdToken,
      fetchImpl: fetchMock,
    });

    // Releasing the unread 429 body prevents repeated capacity failures from tying up provider connections.
    expect(response.status).toBe(200);
    expect(cancelPrimaryBody).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
