import type { JobApplication } from "./types";

export type ApplicationImportMatch = "stable-id" | "company-role-date" | "company-role-link" | "company-role-location" | "undated-company-role";

export interface ApplicationImportPlan {
  additions: JobApplication[];
  updates: JobApplication[];
  skipped: Array<{ application: JobApplication; match: ApplicationImportMatch }>;
  mergedApplications: JobApplication[];
}

function normalizeIdentityPart(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeStableId(value: unknown): string {
  // Firestore document IDs are case-sensitive, so stable identity only trims and normalizes Unicode.
  return String(value ?? "").normalize("NFKC").trim();
}

function normalizeJobLink(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    // Tracking parameters and fragments do not identify a different job posting.
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((parameter) => url.searchParams.delete(parameter));
    return url.toString().replace(/\/$/, "");
  } catch {
    return normalizeIdentityPart(raw);
  }
}

function getIdentityKeys(application: JobApplication): Array<{ key: string; match: ApplicationImportMatch }> {
  const id = normalizeStableId(application.id);
  const company = normalizeIdentityPart(application.companyName);
  const role = normalizeIdentityPart(application.jobTitle);
  const date = normalizeIdentityPart(application.dateApplied);
  const link = normalizeJobLink(application.jobLink);
  const location = normalizeIdentityPart(application.location);
  const keys: Array<{ key: string; match: ApplicationImportMatch }> = [];

  if (id) keys.push({ key: `id:${id}`, match: "stable-id" });
  if (!company || !role) return keys;
  if (date) keys.push({ key: `date:${company}|${role}|${date}`, match: "company-role-date" });
  if (link) keys.push({ key: `link:${company}|${role}|${link}`, match: "company-role-link" });
  if (!date && !link && location) keys.push({ key: `location:${company}|${role}|${location}`, match: "company-role-location" });
  if (!date && !link && !location) keys.push({ key: `undated:${company}|${role}`, match: "undated-company-role" });
  return keys;
}

function importFields(application: JobApplication) {
  // Timestamps and activity history are owner state, not spreadsheet-controlled fields.
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, activityLog: _activityLog, ...fields } = application;
  return fields;
}

function updateStableApplication(existing: JobApplication, imported: JobApplication): JobApplication {
  // An explicit stable-ID match may update spreadsheet fields without replacing owner history.
  return {
    ...existing,
    ...importFields(imported),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: existing.updatedAt,
    activityLog: existing.activityLog,
  };
}

function applicationFieldsEqual(left: JobApplication, right: JobApplication): boolean {
  return JSON.stringify(importFields(left)) === JSON.stringify(importFields(right));
}

export function planApplicationImport(existingApplications: JobApplication[], importedApplications: JobApplication[]): ApplicationImportPlan {
  const additions: JobApplication[] = [];
  const updates: JobApplication[] = [];
  const skipped: ApplicationImportPlan["skipped"] = [];
  const initialIds = new Set(existingApplications.map((application) => application.id));
  const updatedIds = new Set<string>();
  const recordsByKey = new Map<string, JobApplication>();

  existingApplications.forEach((application) => {
    getIdentityKeys(application).forEach(({ key }) => recordsByKey.set(key, application));
  });

  importedApplications.forEach((imported) => {
    const matchedKey = getIdentityKeys(imported).find(({ key }) => recordsByKey.has(key));
    const existing = matchedKey ? recordsByKey.get(matchedKey.key) : undefined;

    if (!matchedKey || !existing) {
      additions.push(imported);
      getIdentityKeys(imported).forEach(({ key }) => recordsByKey.set(key, imported));
      return;
    }

    if (matchedKey.match === "stable-id" && initialIds.has(existing.id) && !updatedIds.has(existing.id)) {
      const updated = updateStableApplication(existing, imported);
      if (!applicationFieldsEqual(existing, updated)) {
        updates.push(updated);
        updatedIds.add(existing.id);
        getIdentityKeys(updated).forEach(({ key }) => recordsByKey.set(key, updated));
        return;
      }
    }

    // Composite matches and repeated rows are skipped to avoid overwriting owner-edited records.
    skipped.push({ application: imported, match: matchedKey.match });
  });

  const updatesById = new Map(updates.map((application) => [application.id, application]));
  return {
    additions,
    updates,
    skipped,
    mergedApplications: [
      ...existingApplications.map((application) => updatesById.get(application.id) ?? application),
      ...additions,
    ],
  };
}
