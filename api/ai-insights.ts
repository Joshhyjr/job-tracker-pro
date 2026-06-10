// Keep the function contract local so Vercel's Node runtime does not import browser-only modules.
interface AiInsightSummary {
  totalApplications: number;
  appliedThisWeek: number;
  appliedLastWeek: number;
  appliedThisMonth: number;
  interviewCount: number;
  interviewRate: number;
  offerCount: number;
  offerRate: number;
  staleNoResponseCount: number;
  overdueFollowUpCount: number;
  missingFollowUpDateCount: number;
  statusBreakdown: Array<{ status: string; count: number }>;
  topCompanies: Array<{ name: string; count: number }>;
  topRoles: Array<{ name: string; count: number }>;
  topLocations: Array<{ name: string; count: number }>;
  recentMomentum: "up" | "down" | "flat";
  improvementSignals: string[];
}

interface AiInsights {
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  recommendedNextActions: string[];
}

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const FALLBACK_GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_REQUEST_BYTES = 16_384;
const MAX_TEXT_LENGTH = 160;
const MAX_LIST_ITEMS = 8;
const MAX_RESPONSE_ITEMS = 4;

type HandlerOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getExpectedOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  return `${protocol}://${host}`;
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Requests without Origin are allowed for local testing and non-browser clients.
  return !origin || origin === getExpectedOrigin(request);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedNumber(value: unknown, max = 1_000_000): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}

function boundedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= MAX_TEXT_LENGTH ? text : null;
}

function parseCountItems(value: unknown, nameKey: "name" | "status", limit = MAX_LIST_ITEMS): Array<Record<string, string | number>> | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const parsed: Array<Record<string, string | number>> = [];

  for (const item of value) {
    if (!isRecord(item)) return null;
    const name = boundedText(item[nameKey]);
    const count = boundedNumber(item.count);
    if (name === null || count === null) return null;
    parsed.push({ [nameKey]: name, count });
  }

  return parsed;
}

function parseSignals(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) return null;
  const signals = value.map(boundedText);
  return signals.every((item): item is string => item !== null) ? signals : null;
}

function parseSummary(value: unknown): AiInsightSummary | null {
  if (!isRecord(value)) return null;

  const numberFields = [
    "totalApplications",
    "appliedThisWeek",
    "appliedLastWeek",
    "appliedThisMonth",
    "interviewCount",
    "interviewRate",
    "offerCount",
    "offerRate",
    "staleNoResponseCount",
    "overdueFollowUpCount",
    "missingFollowUpDateCount",
  ] as const;
  const numbers = Object.fromEntries(numberFields.map((field) => [field, boundedNumber(value[field])]));
  if (Object.values(numbers).some((item) => item === null)) return null;

  const statusBreakdown = parseCountItems(value.statusBreakdown, "status");
  const topCompanies = parseCountItems(value.topCompanies, "name", 3);
  const topRoles = parseCountItems(value.topRoles, "name", 3);
  const topLocations = parseCountItems(value.topLocations, "name", 3);
  const improvementSignals = parseSignals(value.improvementSignals);
  const recentMomentum = value.recentMomentum;
  if (!statusBreakdown || !topCompanies || !topRoles || !topLocations || !improvementSignals || !["up", "down", "flat"].includes(String(recentMomentum))) return null;

  // Rebuilding the object from allowed fields prevents accidental private fields from reaching Gemini.
  return {
    ...(numbers as unknown as Pick<AiInsightSummary, typeof numberFields[number]>),
    statusBreakdown: statusBreakdown as AiInsightSummary["statusBreakdown"],
    topCompanies: topCompanies as AiInsightSummary["topCompanies"],
    topRoles: topRoles as AiInsightSummary["topRoles"],
    topLocations: topLocations as AiInsightSummary["topLocations"],
    recentMomentum: recentMomentum as AiInsightSummary["recentMomentum"],
    improvementSignals,
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean).slice(0, MAX_RESPONSE_ITEMS);
}

function normalizeGeminiInsights(value: unknown): AiInsights {
  const record = isRecord(value) ? value : {};
  return {
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    strengths: normalizeStringList(record.strengths),
    improvementAreas: normalizeStringList(record.improvementAreas),
    recommendedNextActions: normalizeStringList(record.recommendedNextActions),
  };
}

function hasInsights(insights: AiInsights): boolean {
  return Boolean(insights.summary || insights.strengths.length || insights.improvementAreas.length || insights.recommendedNextActions.length);
}

function buildGeminiRequest(summary: AiInsightSummary): unknown {
  return {
    systemInstruction: {
      parts: [{
        text: "You are a practical job-search coach. Use only the provided summary data. Be concise and do not invent companies, hidden notes, or personal details.",
      }],
    },
    contents: [{
      role: "user",
      parts: [{ text: JSON.stringify({ task: "Give privacy-preserving job-search insights and what to improve next.", summary }) }],
    }],
    generationConfig: {
      temperature: 0.2,
      // These REST fields are supported by the Generative Language API used by the Vercel function.
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          strengths: { type: "array", items: { type: "string" }, maxItems: MAX_RESPONSE_ITEMS },
          improvementAreas: { type: "array", items: { type: "string" }, maxItems: MAX_RESPONSE_ITEMS },
          recommendedNextActions: { type: "array", items: { type: "string" }, maxItems: MAX_RESPONSE_ITEMS },
        },
        required: ["summary", "strengths", "improvementAreas", "recommendedNextActions"],
      },
    },
  };
}

function extractGeminiText(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return null;
  const firstCandidate = payload.candidates[0];
  if (!isRecord(firstCandidate) || !isRecord(firstCandidate.content) || !Array.isArray(firstCandidate.content.parts)) return null;
  const text = firstCandidate.content.parts
    .filter(isRecord)
    .map((part) => part.text)
    .find((part): part is string => typeof part === "string");
  return text || null;
}

export async function handleAiInsightsRequest(request: Request, options: HandlerOptions = {}): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);
  if (!isSameOrigin(request)) return jsonResponse({ error: "Cross-origin requests are not allowed." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return jsonResponse({ error: "Content-Type must be application/json." }, 415);

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return jsonResponse({ error: "Request payload is too large." }, 413);

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return jsonResponse({ error: "Could not read request payload." }, 400);
  }
  if (new TextEncoder().encode(bodyText).byteLength > MAX_REQUEST_BYTES) return jsonResponse({ error: "Request payload is too large." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: "Request payload must be valid JSON." }, 400);
  }

  const summary = isRecord(body) ? parseSummary(body.summary) : null;
  if (!summary) return jsonResponse({ error: "Request summary is invalid." }, 400);

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonResponse({ error: "Hosted AI insights are not configured." }, 503);

  const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const models = Array.from(new Set([model, FALLBACK_GEMINI_MODEL]));
  const fetchImpl = options.fetchImpl ?? fetch;
  let geminiResponse: Response | null = null;

  for (const candidateModel of models) {
    try {
      geminiResponse = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(buildGeminiRequest(summary)),
      });
    } catch {
      geminiResponse = null;
    }

    if (geminiResponse?.ok) break;

    const providerError = geminiResponse ? await geminiResponse.text().catch(() => "") : "";
    const canTryFallback = candidateModel !== models[models.length - 1] && (!geminiResponse || [429, 503].includes(geminiResponse.status));
    if (canTryFallback) {
      // Capacity failures should try a smaller hosted model before falling back to local Ollama.
      console.warn("Gemini primary model unavailable; trying fallback", { model: candidateModel, status: geminiResponse?.status });
      continue;
    }

    // Provider diagnostics stay in Vercel logs while the browser receives a sanitized error.
    console.error("Gemini request failed", { model: candidateModel, status: geminiResponse?.status, detail: providerError.slice(0, 500) });
    return jsonResponse({ error: "Hosted AI insights are temporarily unavailable." }, 502);
  }

  let geminiPayload: unknown;
  try {
    geminiPayload = await geminiResponse!.json();
  } catch {
    return jsonResponse({ error: "Hosted AI insights returned an invalid response." }, 502);
  }

  const text = extractGeminiText(geminiPayload);
  if (!text) return jsonResponse({ error: "Hosted AI insights returned an invalid response." }, 502);

  let insights: AiInsights;
  try {
    insights = normalizeGeminiInsights(JSON.parse(text));
  } catch {
    return jsonResponse({ error: "Hosted AI insights returned an invalid response." }, 502);
  }
  if (!hasInsights(insights)) return jsonResponse({ error: "Hosted AI insights returned an empty response." }, 502);

  return jsonResponse(insights, 200);
}

async function toWebRequest(request: IncomingMessage): Promise<Request> {
  const headers = new Headers();
  Object.entries(request.headers).forEach(([name, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  });

  const protocolHeader = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader || "https";
  const host = request.headers.host || "localhost";
  const method = request.method || "GET";
  const chunks: Buffer[] = [];

  if (method !== "GET" && method !== "HEAD") {
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  // Vercel's default Node handler uses IncomingMessage, while the core stays testable with Web Request.
  return new Request(`${protocol}://${host}${request.url || "/"}`, {
    method,
    headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const webResponse = await handleAiInsightsRequest(await toWebRequest(request));
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await webResponse.text());
  } catch {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "Hosted AI insights are temporarily unavailable." }));
  }
}
import type { IncomingMessage, ServerResponse } from "node:http";
