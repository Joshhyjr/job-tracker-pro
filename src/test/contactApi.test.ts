import { beforeEach, describe, expect, it, vi } from "vitest";
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

    expect(invalidEmailResponse.status).toBe(400);
    expect(missingConfigResponse.status).toBe(503);
  });

  it("forwards valid messages through the email provider without exposing the recipient to the browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "email-id" }));
    const response = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "I saw your portfolio and would like to talk.",
    }), {
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
});
