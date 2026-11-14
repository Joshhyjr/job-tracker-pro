import { z } from "zod";
import { CURRENT_STATUSES } from "@/lib/types";

export const MAX_TRANSFER_BYTES = 20 * 1024 * 1024;
const publicKeys = new Set(["theme", "job-tracker-demo-data", "job-tracker-demo-seeded", "job-tracker-demo-latest-import-backup", "job-tracker-response-status-order", "job-tracker-documents-v2:demo"]);
const privateKeys = new Set(["job-tracker-data", "job-tracker-seeded", "job-tracker-import-warnings", "job-tracker-last-import", "job-tracker-latest-import-backup", "job-tracker-documents-v1", "jobtracker.companyDomainDirectory"]);
const text = z.string().max(MAX_TRANSFER_BYTES);
// Check fields used by the tracker before accepting a local recovery file.
const application = z.object({
  id: z.string().min(1), jobTitle: z.string(), companyName: z.string(), location: z.string(),
  currentStatus: z.string().refine((value) => CURRENT_STATUSES.includes(value as typeof CURRENT_STATUSES[number])),
  responseStatus: z.string(), followUps: z.boolean(), dateApplied: z.string(), notes: z.string(), followUpDate: z.string(),
  city: z.string().optional(), region: z.string().optional(), country: z.string().optional(), countryCode: z.string().optional(),
  latitude: z.number().finite().optional(), longitude: z.number().finite().optional(),
  workMode: z.enum(["Remote", "Hybrid", "On-site"]).optional(),
  locationStatus: z.enum(["resolved", "needs_review", "work_mode_only"]).optional(),
  roleFit: z.enum(["strong", "moderate", "stretch"]).optional(),
  coverLetterIncluded: z.boolean().optional(), resumeTailored: z.boolean().optional(),
  recruiterContactName: z.string().optional(), interviewDate: z.string().optional(), tags: z.string().optional(),
  jobLink: z.string().optional(), salary: z.string().optional(), createdAt: z.string().optional(), updatedAt: z.string().optional(),
  customFields: z.record(z.string()).optional(),
  activityLog: z.array(z.object({
    id: z.string(), date: z.string(), type: z.enum(["status_change", "follow_up", "note"]), message: z.string(),
    fromStatus: z.string().optional(), toStatus: z.string().optional(),
  }).passthrough()),
}).passthrough();
const documents = z.array(z.object({ id: z.string().min(1), name: z.string().min(1), category: z.enum(["Resumes", "Cover letters", "Job descriptions", "Certificates", "Other files"]), size: z.number().finite().nonnegative(), updatedAt: z.string(), dataUrl: z.string().regex(/^data:[^,]*,/) }).strict());
const envelope = z.object({ format: z.literal("job-tracker-local-transfer"), version: z.literal(1), createdAt: z.string().datetime(), ownerId: z.string().min(1).nullable(), entries: z.record(text).refine((entries) => Object.keys(entries).length <= 25) }).strict();
export type LocalTransfer = z.infer<typeof envelope>;

function isPrivateKey(key: string): boolean {
  return privateKeys.has(key) || key.startsWith("job-tracker-documents-v2:owner:");
}

function isAllowedKey(key: string, ownerId?: string | null): boolean {
  // Never copy arbitrary prefixes: Firebase credentials and unrelated storage must stay on their origin.
  return publicKeys.has(key) || Boolean(ownerId && (privateKeys.has(key) || key === `job-tracker-documents-v2:owner:${ownerId}`));
}

function validateValue(key: string, value: string): void {
  if (key === "theme") { z.enum(["light", "dark", "system"]).parse(value); return; }
  if (key.endsWith("seeded")) { z.literal("true").parse(value); return; }
  const parsed: unknown = JSON.parse(value);
  if (key.startsWith("job-tracker-documents-")) documents.parse(parsed);
  else if (["job-tracker-data", "job-tracker-demo-data"].includes(key)) z.array(application).max(10_000).parse(parsed);
  else if (key.endsWith("import-backup")) z.object({ id: z.string(), createdAt: z.string(), sourceFileName: z.string(), applications: z.array(application).max(10_000) }).strict().parse(parsed);
  else if (["job-tracker-response-status-order", "job-tracker-import-warnings"].includes(key)) z.array(z.string()).parse(parsed);
  else if (key === "job-tracker-last-import") z.object({ fileName: z.string(), importedAt: z.string(), rowCount: z.number().nonnegative(), warningCount: z.number().nonnegative() }).strict().parse(parsed);
  else z.record(z.string()).parse(parsed);
}

export function parseTransfer(raw: string): LocalTransfer {
  if (new Blob([raw]).size > MAX_TRANSFER_BYTES) throw new Error("Transfer files must be under 20 MB.");
  const backup = envelope.parse(JSON.parse(raw));
  for (const [key, value] of Object.entries(backup.entries)) {
    if (!isAllowedKey(key, backup.ownerId)) throw new Error("Transfer contains an unsupported storage key or owner.");
    validateValue(key, value);
  }
  // Combine old and scoped source files before preview; scoped versions win duplicate IDs.
  if (backup.ownerId && backup.entries["job-tracker-documents-v1"] !== undefined) {
    const scopedKey = `job-tracker-documents-v2:owner:${backup.ownerId}`;
    const legacy = documents.parse(JSON.parse(backup.entries["job-tracker-documents-v1"]));
    const scoped = documents.parse(JSON.parse(backup.entries[scopedKey] ?? "[]"));
    const combined = new Map([...legacy, ...scoped].map((document) => [document.id, document]));
    backup.entries[scopedKey] = JSON.stringify([...combined.values()]);
    delete backup.entries["job-tracker-documents-v1"];
  }
  return backup;
}

export function createTransfer(storage: Storage, ownerId?: string): LocalTransfer {
  const entries: Record<string, string> = {};
  // Reading directly intentionally reports blocked/corrupt storage instead of claiming a successful empty export.
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key && isAllowedKey(key, ownerId)) {
      const value = storage.getItem(key);
      if (value !== null) entries[key] = value;
    }
  }
  return parseTransfer(JSON.stringify({ format: "job-tracker-local-transfer", version: 1, createdAt: new Date().toISOString(), ownerId: ownerId ?? null, entries }));
}

export function restoreTransfer(backup: LocalTransfer, storage: Storage, ownerId?: string): void {
  const validated = parseTransfer(JSON.stringify(backup));
  if (Object.keys(validated.entries).some(isPrivateKey)) {
    if (!ownerId) throw new Error("Sign in before restoring private data.");
    if (validated.ownerId !== ownerId) throw new Error("Sign in as the same owner who exported this file.");
  }
  const entries = Object.entries(validated.entries);
  const previous = new Map(entries.map(([key]) => [key, storage.getItem(key)]));
  const written: string[] = [];
  try {
    for (const [key, value] of entries) {
      written.push(key);
      storage.setItem(key, value);
      if (storage.getItem(key) !== value) throw new Error("Storage verification failed.");
    }
  } catch {
    let recovered = true;
    // Reverse writes restore destination data; the downloaded file and source storage remain untouched.
    for (const key of written.reverse()) {
      try {
        const old = previous.get(key)!;
        if (old === null) storage.removeItem(key); else storage.setItem(key, old);
        if (storage.getItem(key) !== old) recovered = false;
      } catch { recovered = false; }
    }
    throw new Error(recovered ? "Import failed; previous browser data was restored. Free storage and retry." : "Import failed and rollback could not finish. Keep your transfer file and retry after allowing browser storage.");
  }
}
