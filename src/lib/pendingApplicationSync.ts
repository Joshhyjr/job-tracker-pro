import { safeLocalStorageGetItem, safeLocalStorageRemoveItem, safeLocalStorageSetItem } from "./browserStorage";
import { sanitizeActivityLog, sanitizeApplicationInput, sanitizeSingleLineText } from "./security";
import { generateId } from "./storage";
import type { JobApplication } from "./types";

const PENDING_SYNC_KEY_PREFIX = "job-tracker-pending-sync-v1";

export interface PendingApplicationSyncEntry {
  entryId: string;
  operation: "add" | "update";
  queuedAt: string;
  application: JobApplication;
}

interface PendingApplicationSyncDocument {
  version: 1;
  ownerId: string;
  entries: PendingApplicationSyncEntry[];
}

function storageKey(ownerId: string): string {
  // The authenticated UID is part of the key so one owner's pending jobs can never enter another account.
  return `${PENDING_SYNC_KEY_PREFIX}:${encodeURIComponent(ownerId)}`;
}

function restoreApplication(value: unknown): JobApplication | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<JobApplication>;
  const id = sanitizeSingleLineText(record.id);
  if (!id) return null;
  const createdAt = sanitizeSingleLineText(record.createdAt);
  const updatedAt = sanitizeSingleLineText(record.updatedAt);
  // Pending rows pass through the same untrusted-input boundary as Firestore and workbook records.
  return {
    ...sanitizeApplicationInput(record),
    id,
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    activityLog: sanitizeActivityLog(record.activityLog),
  };
}

function restoreEntry(value: unknown): PendingApplicationSyncEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PendingApplicationSyncEntry>;
  const entryId = sanitizeSingleLineText(record.entryId);
  const queuedAt = sanitizeSingleLineText(record.queuedAt);
  const application = restoreApplication(record.application);
  if (!entryId || !queuedAt || !application || (record.operation !== "add" && record.operation !== "update")) return null;
  return { entryId, queuedAt, operation: record.operation, application };
}

export function getPendingApplicationSync(ownerId: string): PendingApplicationSyncEntry[] {
  const raw = safeLocalStorageGetItem(storageKey(ownerId));
  if (!raw) return [];
  try {
    const document = JSON.parse(raw) as Partial<PendingApplicationSyncDocument>;
    if (document.version !== 1 || document.ownerId !== ownerId || !Array.isArray(document.entries)) return [];
    return document.entries.flatMap((entry) => {
      const restored = restoreEntry(entry);
      return restored ? [restored] : [];
    });
  } catch {
    return [];
  }
}

function persistPendingApplicationSync(ownerId: string, entries: PendingApplicationSyncEntry[]): PendingApplicationSyncEntry[] {
  const key = storageKey(ownerId);
  if (entries.length === 0) {
    safeLocalStorageRemoveItem(key);
    // A failed cleanup must remain visible rather than falsely reporting that cloud synchronization completed.
    if (safeLocalStorageGetItem(key) !== null) throw new Error("Could not clear synchronized jobs from browser storage.");
    return [];
  }

  const document: PendingApplicationSyncDocument = { version: 1, ownerId, entries };
  safeLocalStorageSetItem(key, JSON.stringify(document));
  const persisted = getPendingApplicationSync(ownerId);
  const persistedIds = new Set(persisted.map((entry) => entry.entryId));
  // Verify every entry because browser quota or privacy settings may silently reject localStorage writes.
  if (persisted.length !== entries.length || entries.some((entry) => !persistedIds.has(entry.entryId))) {
    throw new Error("Could not save pending jobs in this browser. The import was not applied.");
  }
  return persisted;
}

export function enqueuePendingApplicationSync(
  ownerId: string,
  additions: JobApplication[],
  updates: JobApplication[],
): PendingApplicationSyncEntry[] {
  const entriesByApplicationId = new Map(getPendingApplicationSync(ownerId).map((entry) => [entry.application.id, entry]));
  const queue = (application: JobApplication, requestedOperation: PendingApplicationSyncEntry["operation"]) => {
    const existing = entriesByApplicationId.get(application.id);
    // A job that has never reached Firestore remains an addition even if a later local import edits it.
    const operation = existing?.operation === "add" ? "add" : requestedOperation;
    entriesByApplicationId.set(application.id, {
      entryId: generateId(),
      operation,
      queuedAt: new Date().toISOString(),
      application,
    });
  };
  updates.forEach((application) => queue(application, "update"));
  additions.forEach((application) => queue(application, "add"));
  return persistPendingApplicationSync(ownerId, Array.from(entriesByApplicationId.values()));
}

export function acknowledgePendingApplicationSync(ownerId: string, entryIds: string[]): PendingApplicationSyncEntry[] {
  const acknowledgedIds = new Set(entryIds);
  // Entry IDs, rather than application IDs, prevent an older sync attempt from clearing a newer local edit.
  const remaining = getPendingApplicationSync(ownerId).filter((entry) => !acknowledgedIds.has(entry.entryId));
  return persistPendingApplicationSync(ownerId, remaining);
}

export function overlayPendingApplications(
  cloudApplications: JobApplication[],
  pendingEntries: PendingApplicationSyncEntry[],
): JobApplication[] {
  const pendingById = new Map(pendingEntries.map((entry) => [entry.application.id, entry.application]));
  const cloudIds = new Set(cloudApplications.map((application) => application.id));
  // Pending edits replace their cloud version, while additions remain visible until the realtime listener confirms them.
  return [
    ...cloudApplications.map((application) => pendingById.get(application.id) ?? application),
    ...pendingEntries.flatMap((entry) => cloudIds.has(entry.application.id) ? [] : [entry.application]),
  ].sort((left, right) => (right.dateApplied || "").localeCompare(left.dateApplied || ""));
}
