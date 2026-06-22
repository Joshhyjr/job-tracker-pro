import { describe, expect, it, vi } from "vitest";
import { handleContactRequest } from "../../api/contact";
import { resetRateLimitStore } from "../../api/_shared/security";

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
  it("rate limits repeated contact submissions from the same client", async () => {
    resetRateLimitStore();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "email-id" }));

    for (let attempt = 0; attempt < 5; attempt += 1) {
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
      expect(response.status).toBe(200);
    }

    const limitedResponse = await handleContactRequest(request({
      name: "Visitor",
      email: "visitor@example.com",
      message: "Hello again",
    }), {
      apiKey: "resend-test-key",
      fromEmail: "Portfolio <site@example.com>",
      toEmail: "private-inbox@example.com",
      fetchImpl: fetchMock,
    });

    expect(limitedResponse.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rejects unsupported methods and cross-origin requests", async () => {
    resetRateLimitStore();
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
    resetRateLimitStore();
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
    resetRateLimitStore();
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
