import type { IncomingMessage, ServerResponse } from "node:http";
// Explicit JavaScript specifiers remain resolvable after Vercel emits these TypeScript functions as Node ESM.
import {
  RequestPayloadTooLargeError,
  cancelResponseBody,
  enforceRateLimit,
  getProviderRequestId,
  isAllowedBrowserRequest,
  isJsonRequest,
  jsonResponse,
  toBoundedWebRequest,
} from "./_shared/security.js";

const MAX_REQUEST_BYTES = 8_192;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 3_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 5;

type HandlerOptions = {
  apiKey?: string;
  fromEmail?: string;
  toEmail?: string;
  fetchImpl?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function buildEmailHtml(name: string, email: string, message: string): string {
  const escapedMessage = escapeHtml(message).replace(/\n/g, "<br />");
  return `
    <h2>Portfolio contact message</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Message:</strong></p>
    <p>${escapedMessage}</p>
  `;
}

export async function handleContactRequest(request: Request, options: HandlerOptions = {}): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  if (!isAllowedBrowserRequest(request)) return jsonResponse({ error: "Cross-origin requests are not allowed." }, 403);
  // Throttle before parsing or calling Resend so repeated same-origin submissions cannot consume provider quota.
  const rateLimitResponse = enforceRateLimit(request, "contact", RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
  if (rateLimitResponse) return rateLimitResponse;
  if (!isJsonRequest(request)) return jsonResponse({ error: "Content-Type must be application/json." }, 415);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return jsonResponse({ error: "Message is too large." }, 413);

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return jsonResponse({ error: "Could not read message." }, 400);
  }
  if (new TextEncoder().encode(bodyText).byteLength > MAX_REQUEST_BYTES) return jsonResponse({ error: "Message is too large." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: "Message must be valid JSON." }, 400);
  }

  const name = isRecord(body) ? boundedText(body.name, MAX_NAME_LENGTH) : null;
  const email = isRecord(body) ? boundedText(body.email, MAX_EMAIL_LENGTH) : null;
  const message = isRecord(body) ? boundedText(body.message, MAX_MESSAGE_LENGTH) : null;
  if (!name || !email || !message || !isValidEmail(email)) return jsonResponse({ error: "Please provide a valid name, email, and message." }, 400);

  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  const fromEmail = options.fromEmail ?? process.env.CONTACT_FROM_EMAIL;
  const toEmail = options.toEmail ?? process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !fromEmail || !toEmail) return jsonResponse({ error: "Contact form is not configured." }, 503);

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `Portfolio contact from ${name}`,
      html: buildEmailHtml(name, email, message),
    }),
  });

  const requestId = response.ok ? null : getProviderRequestId(response);
  // Resend's response payload is unused; cancel it so the connection can be released without retaining echoed PII.
  await cancelResponseBody(response);
  if (!response.ok) {
    // Retain only allowlisted correlation metadata; provider bodies may echo contact PII.
    console.error("Contact email failed", requestId ? { status: response.status, requestId } : { status: response.status });
    return jsonResponse({ error: "Message could not be sent right now." }, 502);
  }

  return jsonResponse({ ok: true }, 200);
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const webResponse = await handleContactRequest(await toBoundedWebRequest(request, MAX_REQUEST_BYTES));
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await webResponse.text());
  } catch (error) {
    // Typed size failures remain distinguishable from unexpected runtime errors at the Node adapter boundary.
    const webResponse = error instanceof RequestPayloadTooLargeError
      ? jsonResponse({ error: "Message is too large." }, 413)
      : jsonResponse({ error: "Message could not be sent right now." }, 500);
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await webResponse.text());
  }
}
