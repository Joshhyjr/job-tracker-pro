import { differenceInDays, isBefore, isValid, parseISO, startOfMonth, startOfWeek, subDays } from "date-fns";
import { safeSessionStorageGetItem, safeSessionStorageRemoveItem, safeSessionStorageSetItem } from "./browserStorage";
import type { JobApplication } from "./types";
import { isApplicationOverdue } from "./overdue";
import type { LastImportMetadata } from "./storage";

export interface AiInsightSummary {
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
  dataSource: {
    type: "xlsx-import" | "browser-records";
    fileName: string;
    rowCount: number;
    importedAt: string;
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
    customFieldHeaders: string[];
  };
  recentMomentum: "up" | "down" | "flat";
  improvementSignals: string[];
}

export interface AiInsights {
  summary: string;
  strengths: string[];
  improvementAreas: string[];
  recommendedNextActions: string[];
}

type CountItem = { name: string; count: number };

const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
const MAX_LIST_ITEMS = 3;
const MAX_RESPONSE_ITEMS = 4;
const MAX_CUSTOM_FIELD_HEADERS = 6;
const HOSTED_AI_INSIGHTS_URL = "/api/ai-insights";
const HOSTED_AI_ACCESS_TOKEN_KEY = "job-tracker-ai-access-token";

export function getHostedAiAccessToken(): string {
  // Keep the operator-provided token session-only so it is neither bundled nor retained across browser restarts.
  return safeSessionStorageGetItem(HOSTED_AI_ACCESS_TOKEN_KEY) || "";
}

export function setHostedAiAccessToken(token: string): void {
  const normalized = token.trim();
  if (normalized) safeSessionStorageSetItem(HOSTED_AI_ACCESS_TOKEN_KEY, normalized);
  else safeSessionStorageRemoveItem(HOSTED_AI_ACCESS_TOKEN_KEY);
}

function safeParseDate(value: string): Date | null {
  const parsed = value ? parseISO(value) : null;
  return parsed && isValid(parsed) ? parsed : null;
}

function increment(map: Map<string, number>, rawValue: string | undefined) {
  const value = (rawValue || "").trim();
  if (!value) return;
  map.set(value, (map.get(value) || 0) + 1);
}

function topItems(map: Map<string, number>, limit = MAX_LIST_ITEMS): CountItem[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function getRate(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function getImprovementSignals(summary: Omit<AiInsightSummary, "improvementSignals">): string[] {
  const signals: string[] = [];

  // These signals keep the model focused on coaching the search process, not inventing hidden context.
  if (summary.totalApplications === 0) signals.push("No applications are tracked yet, so recommendations should focus on getting started.");
  if (summary.totalApplications > 0 && summary.interviewRate < 15) signals.push("Interview conversion is below 15%; review resume targeting and role fit.");
  if (summary.staleNoResponseCount > 0) signals.push(`${summary.staleNoResponseCount} applications have had no response after 14+ days.`);
  if (summary.overdueFollowUpCount > 0) signals.push(`${summary.overdueFollowUpCount} applications are currently due for follow-up.`);
  if (summary.missingFollowUpDateCount > 0) signals.push(`${summary.missingFollowUpDateCount} follow-up-enabled applications are missing a follow-up date.`);
  if (summary.appliedThisWeek < summary.appliedLastWeek) signals.push("Application pace is lower this week than last week.");
  if (summary.offerRate === 0 && summary.totalApplications >= 5) signals.push("No offers are tracked yet across at least five applications.");
  if (summary.dataSource.type === "xlsx-import") signals.push(`Recommendations should account for the latest imported workbook: ${summary.dataSource.fileName}.`);
  if (summary.spreadsheetCoverage.withSalary === 0 && summary.totalApplications > 0) signals.push("No salary fields are populated, so compensation targeting cannot be compared yet.");
  if (summary.spreadsheetCoverage.withLocation < summary.totalApplications) signals.push("Some applications are missing location data, which limits geographic insight quality.");

  return signals;
}

function buildDataSource(importMetadata?: LastImportMetadata | null): AiInsightSummary["dataSource"] {
  // Workbook metadata lets the model acknowledge XLSX-backed analysis without retaining the original spreadsheet.
  return {
    type: importMetadata ? "xlsx-import" : "browser-records",
    fileName: importMetadata?.fileName || "",
    rowCount: importMetadata?.rowCount || 0,
    importedAt: importMetadata?.importedAt || "",
    warningCount: importMetadata?.warningCount || 0,
  };
}

function buildSpreadsheetCoverage(applications: JobApplication[]): AiInsightSummary["spreadsheetCoverage"] {
  const customFieldHeaders = new Set<string>();

  const coverage = applications.reduce(
    (acc, application) => {
      if (application.salary) acc.withSalary++;
      if (application.recruiterContactName) acc.withRecruiter++;
      if (application.coverLetterIncluded === true) acc.withCoverLetter++;
      if (application.interviewDate) acc.withInterviewDate++;
      if (application.tags) acc.withTags++;
      if (application.location || application.city || application.region || application.country) acc.withLocation++;
      if (application.latitude !== undefined && application.longitude !== undefined) acc.withCoordinates++;
      if (application.customFields && Object.keys(application.customFields).length > 0) {
        acc.withCustomFields++;
        Object.keys(application.customFields).forEach((header) => customFieldHeaders.add(header));
      }
      return acc;
    },
    {
      withSalary: 0,
      withRecruiter: 0,
      withCoverLetter: 0,
      withInterviewDate: 0,
      withTags: 0,
      withCustomFields: 0,
      withLocation: 0,
      withCoordinates: 0,
      customFieldHeaders: [] as string[],
    },
  );

  return {
    ...coverage,
    customFieldHeaders: Array.from(customFieldHeaders).sort((a, b) => a.localeCompare(b)).slice(0, MAX_CUSTOM_FIELD_HEADERS),
  };
}

export function buildAiInsightSummary(applications: JobApplication[], now = new Date(), importMetadata?: LastImportMetadata | null): AiInsightSummary {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = subDays(weekStart, 7);
  const monthStart = startOfMonth(now);
  const statusCounts = new Map<string, number>();
  const companyCounts = new Map<string, number>();
  const roleCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  let appliedThisWeek = 0;
  let appliedLastWeek = 0;
  let appliedThisMonth = 0;
  let interviewCount = 0;
  let offerCount = 0;
  let staleNoResponseCount = 0;
  let overdueFollowUpCount = 0;
  let missingFollowUpDateCount = 0;

  applications.forEach((application) => {
    const appliedDate = safeParseDate(application.dateApplied);
    const responseStatus = application.responseStatus || application.currentStatus || "Applied";

    increment(statusCounts, responseStatus);
    increment(companyCounts, application.companyName);
    increment(roleCounts, application.jobTitle);
    increment(locationCounts, application.location || application.country || application.city);

    if (/interview|assessment|screen|offer/i.test(responseStatus)) interviewCount++;
    if (/offer/i.test(responseStatus)) offerCount++;
    if (application.followUps && !application.followUpDate) missingFollowUpDateCount++;
    if (isApplicationOverdue(application, now)) overdueFollowUpCount++;

    if (!appliedDate) return;
    if (!isBefore(appliedDate, weekStart)) appliedThisWeek++;
    else if (!isBefore(appliedDate, lastWeekStart)) appliedLastWeek++;
    if (!isBefore(appliedDate, monthStart)) appliedThisMonth++;
    if (/no response/i.test(responseStatus) && differenceInDays(now, appliedDate) >= 14) staleNoResponseCount++;
  });

  const baseSummary = {
    totalApplications: applications.length,
    appliedThisWeek,
    appliedLastWeek,
    appliedThisMonth,
    interviewCount,
    interviewRate: getRate(interviewCount, applications.length),
    offerCount,
    offerRate: getRate(offerCount, applications.length),
    staleNoResponseCount,
    overdueFollowUpCount,
    missingFollowUpDateCount,
    statusBreakdown: topItems(statusCounts, 8).map(({ name, count }) => ({ status: name, count })),
    topCompanies: topItems(companyCounts),
    topRoles: topItems(roleCounts),
    topLocations: topItems(locationCounts),
    dataSource: buildDataSource(importMetadata),
    spreadsheetCoverage: buildSpreadsheetCoverage(applications),
    recentMomentum: appliedThisWeek > appliedLastWeek ? "up" : appliedThisWeek < appliedLastWeek ? "down" : "flat",
  } satisfies Omit<AiInsightSummary, "improvementSignals">;

  return {
    ...baseSummary,
    improvementSignals: getImprovementSignals(baseSummary),
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, MAX_RESPONSE_ITEMS);
}

function normalizeSummary(value: unknown): string {
  if (typeof value === "string") {
    const summary = value.trim();
    return /^(up|down|flat)$/i.test(summary) ? "" : summary;
  }
  if (typeof value !== "object" || value === null) return "";

  const record = value as Record<string, unknown>;
  const preferred = record.text || record.overview || record.message || record.insight;
  if (typeof preferred === "string") return preferred.trim();

  // Some local models return a small object for `summary`; flatten only text values so numeric telemetry is not shown as prose.
  return Object.values(record)
    .filter((item) => typeof item === "string")
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/^(up|down|flat)$/i, "");
}

export function normalizeAiInsights(value: unknown): AiInsights {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    summary: normalizeSummary(record.summary),
    strengths: normalizeStringList(record.strengths),
    improvementAreas: normalizeStringList(record.improvementAreas),
    recommendedNextActions: normalizeStringList(record.recommendedNextActions),
  };
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Ollama returned a non-JSON response.");
  return JSON.parse(trimmed.slice(start, end + 1));
}

export function parseLocalAiInsightsContent(content: string): AiInsights {
  return normalizeAiInsights(extractJsonObject(content));
}

function hasAiInsights(insights: AiInsights): boolean {
  return Boolean(insights.summary || insights.strengths.length || insights.improvementAreas.length || insights.recommendedNextActions.length);
}

export async function generateHostedAiInsights(summary: AiInsightSummary): Promise<AiInsights> {
  let response: Response;
  const accessToken = getHostedAiAccessToken();
  if (!accessToken) throw new Error("Hosted AI insights require an access token.");

  try {
    // The server endpoint owns the Gemini key; the browser sends only the session token and pre-filtered summary.
    response = await fetch(HOSTED_AI_INSIGHTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary }),
    });
  } catch {
    throw new Error("Hosted AI insights are unavailable.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Hosted AI insights returned an unexpected response.");
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : "Hosted AI insights are unavailable.";
    throw new Error(message);
  }

  const insights = normalizeAiInsights(payload);
  if (!hasAiInsights(insights)) throw new Error("Hosted AI insights returned an empty response.");
  return insights;
}

export async function generateLocalAiInsights(summary: AiInsightSummary): Promise<AiInsights> {
  const model = import.meta.env.VITE_OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;

  try {
    const tagsResponse = await fetch(OLLAMA_TAGS_URL);
    if (tagsResponse.ok) {
      const tagsPayload = await tagsResponse.json();
      const hasModel = Array.isArray(tagsPayload?.models) && tagsPayload.models.some((item: { name?: string; model?: string }) => item.name === model || item.model === model);
      if (!hasModel) throw new Error(`Ollama is running, but ${model} is not installed. Run: ollama pull ${model}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not installed")) throw error;
    throw new Error(`Cannot reach Ollama from the browser. Start Ollama with: OLLAMA_ORIGINS=http://localhost:8080 ollama serve`);
  }

  // The prompt requests JSON only so the UI can render stable sections without trusting markdown from the model.
  let response: Response;
  try {
    response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
        messages: [
          {
            role: "system",
            content:
              "You are a practical job-search coach. Use only the provided summary data. Return concise JSON with keys: summary, strengths, improvementAreas, recommendedNextActions. Do not invent companies, hidden notes, or personal details.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Give privacy-preserving job-search insights and what to improve next.",
              summary,
            }),
          },
        ],
      }),
    });
  } catch {
    throw new Error(`Cannot generate insights from Ollama. Start it with: OLLAMA_ORIGINS=http://localhost:8080 ollama serve`);
  }

  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);

  const payload = await response.json();
  const content = payload?.message?.content;
  if (typeof content !== "string") throw new Error("Ollama returned an unexpected response.");

  const insights = parseLocalAiInsightsContent(content);
  if (!hasAiInsights(insights)) {
    throw new Error("Ollama returned empty insights.");
  }

  return insights;
}

export function getConfiguredOllamaModel(): string {
  return import.meta.env.VITE_OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
}

export async function generateAiInsightsWithFallback(
  summary: AiInsightSummary,
  hostedGenerator = generateHostedAiInsights,
  localGenerator = generateLocalAiInsights,
): Promise<AiInsights> {
  if (!getHostedAiAccessToken()) {
    // A blank hosted token is an intentional privacy-first choice: skip Gemini and ask local Ollama directly.
    return localGenerator(summary);
  }

  try {
    return await hostedGenerator(summary);
  } catch (hostedError) {
    const hostedMessage = hostedError instanceof Error ? hostedError.message : "Hosted AI insights failed.";
    // Authentication/configuration failures require operator action; Ollama fallback would hide the useful error.
    if (/access token|authentication required|authentication is not configured/i.test(hostedMessage)) {
      throw new Error(hostedMessage);
    }

    try {
      // Ollama preserves a privacy-first path when Gemini is not configured or temporarily unavailable.
      return await localGenerator(summary);
    } catch (localError) {
      const localMessage = localError instanceof Error ? localError.message : "Local Ollama insights failed.";
      throw new Error(`Gemini failed: ${hostedMessage} Ollama fallback failed: ${localMessage}`);
    }
  }
}
