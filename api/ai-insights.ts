import type { IncomingMessage, ServerResponse } from "node:http";
// Explicit JavaScript specifiers remain resolvable after Vercel emits these TypeScript functions as Node ESM.
import { FirebaseAdminConfigurationError, verifyOwnerIdToken } from "./_shared/firebaseAuth.js";
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

// Keep the function contract local so Vercel's Node runtime does not import browser-only modules.
interface AiInsightSummary {
  totalApplications: number;
  appliedThisWeek: number;
  appliedLastWeek: number;
  appliedThisMonth: number;
  qualifiedThisWeek: number;
  recentQualifiedWeeklyMedian: number;
  awaitingHumanResponseCount: number;
  activeProcessCount: number;
  matureCohortSize: number;
  positiveProgressionCount: number;
  positiveProgressionRate: number;
  metricSignal: "low-signal" | "established";
  qualityCoverageCount: number;
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
  dataSource: {
    type: "xlsx-import" | "browser-records";
    rowCount: number;
    warningCount: number;
  };
  spreadsheetCoverage: {
    withSalary: number;
    withRecruiter: number;
    withCoverLetter: number;
    withInterviewDate: number;
    withTags: number;
    withCustomFields: number;
    withLocation: number;
    withCoordinates: number;
  };
  recentMomentum: "up" | "down" | "flat";
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
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const PRE_AUTH_RATE_LIMIT_MAX_REQUESTS = 60;

type HandlerOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  verifyIdToken?: (idToken: string) => Promise<boolean>;
};

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  // Firebase JWTs are longer than the legacy shared token, but still bounded to reject abusive headers.
  return token.length <= 4_096 ? token : "";
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

function parseDataSource(value: unknown): AiInsightSummary["dataSource"] | null {
  if (!isRecord(value)) return null;
  const type = value.type;
  const rowCount = boundedNumber(value.rowCount);
  const warningCount = boundedNumber(value.warningCount);
  if (!["xlsx-import", "browser-records"].includes(String(type)) || rowCount === null || warningCount === null) return null;

  // Exact workbook names and import timestamps are intentionally absent from the hosted-provider contract.
  return {
    type: type as AiInsightSummary["dataSource"]["type"],
    rowCount,
    warningCount,
  };
}

function parseSpreadsheetCoverage(value: unknown): AiInsightSummary["spreadsheetCoverage"] | null {
  if (!isRecord(value)) return null;
  const numberFields = [
    "withSalary",
    "withRecruiter",
    "withCoverLetter",
    "withInterviewDate",
    "withTags",
    "withCustomFields",
    "withLocation",
    "withCoordinates",
  ] as const;
  const numbers = Object.fromEntries(numberFields.map((field) => [field, boundedNumber(value[field])]));
  if (Object.values(numbers).some((item) => item === null)) return null;

  // Coverage counts remain useful without disclosing user-defined custom-field names.
  return numbers as unknown as AiInsightSummary["spreadsheetCoverage"];
}

function parseSummary(value: unknown): AiInsightSummary | null {
  if (!isRecord(value)) return null;

  const numberFields = [
    "totalApplications",
    "appliedThisWeek",
    "appliedLastWeek",
    "appliedThisMonth",
    "qualifiedThisWeek",
    "recentQualifiedWeeklyMedian",
    "awaitingHumanResponseCount",
    "activeProcessCount",
    "matureCohortSize",
    "positiveProgressionCount",
    "positiveProgressionRate",
    "qualityCoverageCount",
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
  const dataSource = parseDataSource(value.dataSource);
  const spreadsheetCoverage = parseSpreadsheetCoverage(value.spreadsheetCoverage);
  const recentMomentum = value.recentMomentum;
  const metricSignal = value.metricSignal;
  if (!statusBreakdown || !topCompanies || !topRoles || !topLocations || !dataSource || !spreadsheetCoverage || !["up", "down", "flat"].includes(String(recentMomentum)) || !["low-signal", "established"].includes(String(metricSignal))) return null;

  // Rebuilding the object from allowed fields drops extra client properties before Gemini receives the summary.
  return {
    ...(numbers as unknown as Pick<AiInsightSummary, typeof numberFields[number]>),
    statusBreakdown: statusBreakdown as AiInsightSummary["statusBreakdown"],
    topCompanies: topCompanies as AiInsightSummary["topCompanies"],
    topRoles: topRoles as AiInsightSummary["topRoles"],
    topLocations: topLocations as AiInsightSummary["topLocations"],
    dataSource,
    spreadsheetCoverage,
    recentMomentum: recentMomentum as AiInsightSummary["recentMomentum"],
    metricSignal: metricSignal as AiInsightSummary["metricSignal"],
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
  if (!isAllowedBrowserRequest(request)) return jsonResponse({ error: "Cross-origin requests are not allowed." }, 403);
  const idToken = getBearerToken(request);
  if (!idToken) return jsonResponse({ error: "Google authentication required." }, 401);
  // A separate, higher-cap bucket bounds invalid-token verification without letting bots exhaust the owner's quota.
  const preAuthRateLimitResponse = enforceRateLimit(request, "ai-insights-pre-auth", PRE_AUTH_RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
  if (preAuthRateLimitResponse) return preAuthRateLimitResponse;
  try {
    const isApprovedOwner = await (options.verifyIdToken ?? verifyOwnerIdToken)(idToken);
    if (!isApprovedOwner) return jsonResponse({ error: "This Google account is not authorized." }, 403);
  } catch (error) {
    // Missing server credentials are operational failures; invalid or expired user tokens remain authentication failures.
    if (error instanceof FirebaseAdminConfigurationError) return jsonResponse({ error: error.message }, 503);
    return jsonResponse({ error: "Google authentication required." }, 401);
  }
  // Count only authenticated requests so unauthenticated traffic cannot exhaust the owner's AI bucket.
  const rateLimitResponse = enforceRateLimit(request, "ai-insights", RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);
  if (rateLimitResponse) return rateLimitResponse;
  if (!isJsonRequest(request)) return jsonResponse({ error: "Content-Type must be application/json." }, 415);

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

    const providerStatus = geminiResponse?.status;
    const requestId = geminiResponse ? getProviderRequestId(geminiResponse) : null;
    const canTryFallback = candidateModel !== models[models.length - 1] && (!geminiResponse || [429, 503].includes(geminiResponse.status));
    if (geminiResponse) await cancelResponseBody(geminiResponse);
    if (canTryFallback) {
      // Capacity failures release their response stream before trying a smaller hosted model.
      console.warn("Gemini primary model unavailable; trying fallback", { model: candidateModel, status: providerStatus });
      continue;
    }

    // Provider bodies are excluded from logs because upstream errors may echo submitted summary data.
    console.error("Gemini request failed", requestId
      ? { model: candidateModel, status: providerStatus, requestId }
      : { model: candidateModel, status: providerStatus });
    return jsonResponse({ error: "Hosted AI insights are temporarily unavailable." }, 502);
  }

  let geminiPayload: unknown;
  try {
    // A successful Gemini body is consumed for validation, so only unused error bodies are canceled above.
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

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const webResponse = await handleAiInsightsRequest(await toBoundedWebRequest(request, MAX_REQUEST_BYTES));
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await webResponse.text());
  } catch (error) {
    // Preserve the public 413 contract for bodies rejected before the Web Request is constructed.
    const webResponse = error instanceof RequestPayloadTooLargeError
      ? jsonResponse({ error: "Request payload is too large." }, 413)
      : jsonResponse({ error: "Hosted AI insights are temporarily unavailable." }, 500);
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await webResponse.text());
  }
}
