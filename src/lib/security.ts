import { CURRENT_STATUSES, type CurrentStatus, type JobApplication } from "./types";
import { normalizeResponseStatus } from "./responseStatus";

const MAX_SHORT_TEXT_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

export function sanitizeCurrentStatus(value: unknown): CurrentStatus {
  const status = sanitizeSingleLineText(value);
  return (CURRENT_STATUSES as string[]).includes(status) ? (status as CurrentStatus) : "Applied";
}

export function sanitizeApplicationInput(input: Partial<SanitizedApplicationInput>): SanitizedApplicationInput {
  // Future AI enrichment should call a server endpoint; private model/provider keys must never be added to Vite client code.
  return {
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
}
