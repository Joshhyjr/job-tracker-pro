import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleContactRequest } from "../../api/contact";
import { resetRateLimitState } from "../../api/_shared/security";

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://portfolio.example/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: "portfolio.example",
      // Contact messages must originate from the deployed portfolio page.
      Origin: "https://portfolio.example",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  beforeEach(() => {
    // Each case starts with fresh buckets so rate-limit behavior remains deterministic.
    resetRateLimitState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rate limits repeated submissions from the same client ip", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "email-id" }));
    const headers = { "x-forwarded-for": "198.51.100.5" };
    const options = {
      apiKey: "resend-test-key",
      fromEmail: "Portfolio <site@example.com>",
      toEmail: "private-inbox@example.com",
      fetchImpl: fetchMock,
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await handleContactRequest(request({
        name: "Visitor",
        email: "visitor@example.com",
        message: "Hello",
      }, headers), options);
      expect(response.status).toBe(200);
    }

    const throttled = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello",
    }, headers), options);

    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBeTruthy();
    expect(throttled.headers.get("x-ratelimit-limit")).toBe("5");
    expect(throttled.headers.get("x-ratelimit-remaining")).toBe("0");
    await expect(throttled.json()).resolves.toEqual({ error: "Too many requests. Please try again shortly." });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rejects unsupported methods and cross-origin requests", async () => {
    const getResponse = await handleContactRequest(new Request("https://portfolio.example/api/contact"));
    const crossOriginResponse = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello",
    }, { Origin: "https://attacker.example" }));

    expect(getResponse.status).toBe(405);
    expect(crossOriginResponse.status).toBe(403);
  });

  it("rejects invalid payloads and missing email configuration", async () => {
    const invalidContentTypeResponse = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello",
    }, { "Content-Type": "application/jsonx" }));
    const invalidEmailResponse = await handleContactRequest(request({
      name: "Visitor",
      email: "not-an-email",
      message: "Hello",
    }));
    const missingConfigResponse = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello",
    }), {
      apiKey: "",
      fromEmail: "",
      toEmail: "",
    });

    expect(invalidContentTypeResponse.status).toBe(415);
    expect(invalidEmailResponse.status).toBe(400);
    expect(missingConfigResponse.status).toBe(503);
  });

  it("forwards valid messages through the email provider without exposing the recipient to the browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "email-id" }));
    const response = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "I saw your portfolio and would like to talk.",
    }, { "Content-Type": "application/json; charset=utf-8" }), {
      apiKey: "resend-test-key",
      fromEmail: "Portfolio <site@example.com>",
      toEmail: "private-inbox@example.com",
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const [url, options] = fetchMock.mock.calls[0];
    const providerBody = JSON.parse(options.body);
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers.Authorization).toBe("Bearer resend-test-key");
    expect(providerBody.to).toEqual(["private-inbox@example.com"]);
    expect(providerBody.reply_to).toBe("visitor@example.com");
    expect(providerBody.subject).toBe("Portfolio contact from Visitor");
  });

  it("logs only allowlisted provider correlation metadata", async () => {
    const privateProviderDetail = "private-contact-detail-must-not-enter-logs";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cancelProviderBody = vi.fn();
    const providerResponse = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(privateProviderDetail));
      },
      cancel: cancelProviderBody,
    }), {
      status: 422,
      headers: { "x-correlation-id": "resend-correlation-123" },
    });
    const fetchMock = vi.fn().mockResolvedValue(providerResponse);

    const response = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello",
    }), {
      apiKey: "resend-test-key",
      fromEmail: "Portfolio <site@example.com>",
      toEmail: "private-inbox@example.com",
      fetchImpl: fetchMock,
    });

    expect(response.status).toBe(502);
    expect(consoleError).toHaveBeenCalledWith("Contact email failed", {
      status: 422,
      requestId: "resend-correlation-123",
    });
    expect(cancelProviderBody).toHaveBeenCalledOnce();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(privateProviderDetail);
  });

  it("cancels the unused provider response body after a successful send", async () => {
    const cancelProviderBody = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      new ReadableStream({ cancel: cancelProviderBody }),
      { status: 202 },
    ));

    const response = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello",
    }), {
      apiKey: "resend-test-key",
      fromEmail: "Portfolio <site@example.com>",
      toEmail: "private-inbox@example.com",
      fetchImpl: fetchMock,
    });

    // The endpoint does not use Resend's body, so cancellation should release it without decoding content.
    expect(response.status).toBe(200);
    expect(cancelProviderBody).toHaveBeenCalledOnce();
  });
});
