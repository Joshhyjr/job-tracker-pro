import { CURRENT_STATUSES, type ActivityLogEntry, type CurrentStatus, type JobApplication, type RoleFit } from "./types";
import { normalizeResponseStatus } from "./responseStatus";
import { normalizeCompanyDomain } from "./companyLogos";
import { normalizeApplicationGeography } from "./geography";

const MAX_SHORT_TEXT_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const MAX_URL_LENGTH = 2048;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_LOG_TYPES: ActivityLogEntry["type"][] = ["status_change", "follow_up", "note"];
const SAFE_CSS_IDENTIFIER_FALLBACK = "safe";
const SAFE_CSS_COLOR_PATTERN = /^(?:#[\da-f]{3,4}|#[\da-f]{6}(?:[\da-f]{2})?|transparent|currentcolor|black|white|var\(--[a-z0-9_-]+\)|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\((?:(?:[-+.\d%/,\s]+)|var\(--[a-z0-9_-]+\))+\))$/i;

export function sanitizeExternalHttpUrl(value: unknown): string {
  const candidate = sanitizeSingleLineText(value, MAX_URL_LENGTH);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    // External navigation is fail-closed: only absolute HTTP(S) URLs may cross persistence or href boundaries.
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

export type SanitizedApplicationInput = Omit<JobApplication, "id" | "activityLog">;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function stripUnsafeControlCharacters(value: string): string {
  // Allow tabs and line breaks for notes, but remove hidden control characters that do not belong in job data.
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code > 31 && code !== 127);
    })
    .join("");
}

export function sanitizeSingleLineText(value: unknown, maxLength = MAX_SHORT_TEXT_LENGTH): string {
  // Strip invisible control characters so imported or pasted data cannot smuggle unsafe text into the UI.
  return truncate(stripUnsafeControlCharacters(String(value ?? "").normalize("NFKC")).replace(/\s+/g, " ").trim(), maxLength);
}

export function sanitizeMultilineText(value: unknown, maxLength = MAX_NOTES_LENGTH): string {
  // Notes can keep line breaks, but still lose hidden control characters and oversized payloads.
  return truncate(stripUnsafeControlCharacters(String(value ?? "").normalize("NFKC")).trim(), maxLength);
}

export function sanitizeDateInput(value: unknown): string {
  const date = sanitizeSingleLineText(value, 10);
  return DATE_PATTERN.test(date) ? date : "";
}

function normalizeCssIdentifier(value: unknown): string {
  const normalized = sanitizeSingleLineText(value, 120).toLowerCase();
  return normalized
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function sanitizeCssIdentifier(value: unknown, fallback = SAFE_CSS_IDENTIFIER_FALLBACK): string {
  // CSS selectors and custom-property names must never interpolate raw caller-provided identifiers.
  return normalizeCssIdentifier(value) || normalizeCssIdentifier(fallback) || SAFE_CSS_IDENTIFIER_FALLBACK;
}

export function sanitizeCssColor(value: unknown): string {
  const candidate = sanitizeSingleLineText(value, 160);
  if (!SAFE_CSS_COLOR_PATTERN.test(candidate)) return "";
  // Native parsing rejects malformed values while the conservative regex keeps SSR/test behavior fail-closed.
  if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && !CSS.supports("color", candidate)) return "";
  return candidate;
}

export function sanitizeCurrentStatus(value: unknown): CurrentStatus {
  const status = sanitizeSingleLineText(value);
  return (CURRENT_STATUSES as string[]).includes(status) ? (status as CurrentStatus) : "Applied";
}

function sanitizeRoleFit(value: unknown): RoleFit | undefined {
  const normalized = sanitizeSingleLineText(value).toLowerCase();
  if (["strong", "yes", "high"].includes(normalized)) return "strong";
  if (["moderate", "partial", "medium"].includes(normalized)) return "moderate";
  if (["stretch", "no", "low"].includes(normalized)) return "stretch";
  return undefined;
}

function sanitizeFiniteNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === "" || value == null) return undefined;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function sanitizeCustomFields(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const sanitizedEntries = Object.entries(value).flatMap(([key, fieldValue]) => {
    const sanitizedKey = sanitizeSingleLineText(key);
    const sanitizedValue = sanitizeMultilineText(fieldValue);
    return sanitizedKey && sanitizedValue ? [[sanitizedKey, sanitizedValue] as const] : [];
  });

  return sanitizedEntries.length > 0 ? Object.fromEntries(sanitizedEntries) : undefined;
}

export function sanitizeActivityLog(value: unknown): ActivityLogEntry[] {
  if (!Array.isArray(value)) return [];

  // Rehydrate only well-formed entries so corrupted localStorage does not leak invalid shapes into the UI.
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];

    const record = entry as Partial<ActivityLogEntry>;
    const id = sanitizeSingleLineText(record.id);
    const message = sanitizeMultilineText(record.message);
    const date = sanitizeSingleLineText(record.date);
    const type = ACTIVITY_LOG_TYPES.includes(record.type as ActivityLogEntry["type"]) ? record.type : undefined;
    // Preserve structured status-history labels only on status changes; older activity entries remain valid without them.
    const fromStatus = type === "status_change" ? sanitizeSingleLineText(record.fromStatus) : "";
    const toStatus = type === "status_change" ? sanitizeSingleLineText(record.toStatus) : "";

    return id && message && date && type
      ? [{ id, message, date, type, ...(fromStatus ? { fromStatus } : {}), ...(toStatus ? { toStatus } : {}) }]
      : [];
  });
}

export function sanitizeApplicationInput(input: Partial<SanitizedApplicationInput>): SanitizedApplicationInput {
  // Future AI enrichment should call a server endpoint; private model/provider keys must never be added to Vite client code.
  const sanitized: SanitizedApplicationInput = {
    jobTitle: sanitizeSingleLineText(input.jobTitle),
    companyName: sanitizeSingleLineText(input.companyName),
    location: sanitizeSingleLineText(input.location),
    currentStatus: sanitizeCurrentStatus(input.currentStatus),
    responseStatus: normalizeResponseStatus(sanitizeSingleLineText(input.responseStatus)),
    followUps: Boolean(input.followUps),
    dateApplied: sanitizeDateInput(input.dateApplied),
    notes: sanitizeMultilineText(input.notes),
    followUpDate: sanitizeDateInput(input.followUpDate),
  };

  // Preserve optional workbook/app fields instead of silently dropping them during create/update sanitization.
  // Normalize geography once at the persistence boundary so aliases and work modes cannot leak into country/city fields.
  const geography = normalizeApplicationGeography(input);
  const jobLink = sanitizeExternalHttpUrl(input.jobLink);
  // Company branding overrides are normalized/validated by the logo service before being stored.
  const companyDomain = normalizeCompanyDomain(sanitizeSingleLineText(input.companyDomain, MAX_URL_LENGTH)) ?? "";
  const companyLogoUrl = sanitizeExternalHttpUrl(input.companyLogoUrl);
  const salary = sanitizeSingleLineText(input.salary);
  const recruiterContactName = sanitizeSingleLineText(input.recruiterContactName);
  const tags = sanitizeSingleLineText(input.tags);
  const interviewDate = sanitizeDateInput(input.interviewDate);
  const daysSinceApplied = sanitizeFiniteNumber(input.daysSinceApplied, 0, Number.MAX_SAFE_INTEGER);
  const latitude = sanitizeFiniteNumber(input.latitude, -90, 90);
  const longitude = sanitizeFiniteNumber(input.longitude, -180, 180);
  const customFields = sanitizeCustomFields(input.customFields);
  const roleFit = sanitizeRoleFit(input.roleFit ?? input.customFields?.["Role Fit"] ?? input.customFields?.["70% Match?"]);
  const legacyTailoredResume = sanitizeSingleLineText(input.customFields?.["Tailored Resume?"] ?? input.customFields?.["Tailored Resume"]).toLowerCase();
  const resumeTailored = typeof input.resumeTailored === "boolean"
    ? input.resumeTailored
    : legacyTailoredResume === "yes" ? true : legacyTailoredResume === "no" || legacyTailoredResume === "general resume" ? false : undefined;

  if (geography.city) sanitized.city = geography.city;
  if (geography.region) sanitized.region = geography.region;
  if (geography.country) sanitized.country = geography.country;
  if (geography.countryCode) sanitized.countryCode = geography.countryCode;
  if (geography.workMode) sanitized.workMode = geography.workMode;
  sanitized.locationStatus = geography.locationStatus;
  if (jobLink) sanitized.jobLink = jobLink;
  if (companyDomain) sanitized.companyDomain = companyDomain;
  if (companyLogoUrl) sanitized.companyLogoUrl = companyLogoUrl;
  if (salary) sanitized.salary = salary;
  if (recruiterContactName) sanitized.recruiterContactName = recruiterContactName;
  if (tags) sanitized.tags = tags;
  if (interviewDate) sanitized.interviewDate = interviewDate;
  if (daysSinceApplied !== undefined) sanitized.daysSinceApplied = daysSinceApplied;
  if (typeof input.coverLetterIncluded === "boolean") sanitized.coverLetterIncluded = input.coverLetterIncluded;
  if (roleFit) sanitized.roleFit = roleFit;
  if (resumeTailored !== undefined) sanitized.resumeTailored = resumeTailored;
  if (geography.latitude !== undefined) sanitized.latitude = geography.latitude;
  else if (latitude !== undefined) sanitized.latitude = latitude;
  if (geography.longitude !== undefined) sanitized.longitude = geography.longitude;
  else if (longitude !== undefined) sanitized.longitude = longitude;
  if (customFields) sanitized.customFields = customFields;

  return sanitized;
}
