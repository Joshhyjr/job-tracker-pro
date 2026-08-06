import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDatabase } from "./firebase";
import { generateId, type ImportBackup } from "./storage";
import type { JobApplication } from "./types";
import { sanitizeActivityLog, sanitizeApplicationInput, sanitizeSingleLineText } from "./security";

const BATCH_OPERATION_LIMIT = 450;

function applicationCollection(userId: string) {
  return collection(getFirestoreDatabase(), "users", userId, "applications");
}

function importBackupCollection(userId: string) {
  return collection(getFirestoreDatabase(), "users", userId, "importBackups");
}

function importBackupApplicationCollection(userId: string, backupId: string) {
  return collection(getFirestoreDatabase(), "users", userId, "importBackups", backupId, "applications");
}

// JSON normalization removes undefined optional fields, which Firestore rejects by default.
export function serializeApplication(application: JobApplication): DocumentData {
  const sanitized: JobApplication = {
    ...sanitizeApplicationInput(application),
    id: sanitizeSingleLineText(application.id),
    createdAt: sanitizeSingleLineText(application.createdAt),
    updatedAt: sanitizeSingleLineText(application.updatedAt),
    activityLog: sanitizeActivityLog(application.activityLog),
  };
  return JSON.parse(JSON.stringify(sanitized));
}

export function deserializeApplication(id: string, data: DocumentData): JobApplication {
  const record = data as Partial<JobApplication>;
  // Treat cloud documents as untrusted input just like XLSX and browser storage records.
  return {
    ...sanitizeApplicationInput(record),
    id: sanitizeSingleLineText(id),
    createdAt: sanitizeSingleLineText(record.createdAt),
    updatedAt: sanitizeSingleLineText(record.updatedAt),
    activityLog: sanitizeActivityLog(record.activityLog),
  };
}

export async function createApplicationImportBackup(
  userId: string,
  sourceFileName: string,
  mode: "merge" | "replace",
): Promise<ImportBackup> {
  // Read the authoritative server collection so the snapshot cannot silently omit a newer cross-device change.
  const currentSnapshot = await getDocsFromServer(applicationCollection(userId));
  const applications = currentSnapshot.docs.map((item) => deserializeApplication(item.id, item.data()));
  const id = generateId();
  const createdAt = new Date().toISOString();
  const backup: ImportBackup = {
    id,
    createdAt,
    sourceFileName: sanitizeSingleLineText(sourceFileName, 255) || "Imported workbook",
    applications,
  };
  const expectedIds = new Set(applications.map((application) => application.id));
  if (expectedIds.size !== applications.length) {
    throw new Error("Could not create the Firestore backup because application IDs are not unique.");
  }

  const manifestRef = doc(importBackupCollection(userId), id);
  // A writing manifest makes interrupted snapshots visible but never eligible as recovery points.
  await setDoc(manifestRef, {
    createdAt,
    sourceFileName: backup.sourceFileName,
    applicationCount: applications.length,
    mode,
    status: "writing",
  });

  const backupApplications = importBackupApplicationCollection(userId, id);
  for (let index = 0; index < applications.length; index += BATCH_OPERATION_LIMIT) {
    const batch = writeBatch(getFirestoreDatabase());
    applications.slice(index, index + BATCH_OPERATION_LIMIT).forEach((application) => {
      batch.set(doc(backupApplications, application.id), serializeApplication(application));
    });
    await batch.commit();
  }

  const persistedSnapshot = await getDocs(backupApplications);
  const persistedIds = new Set(persistedSnapshot.docs.map((item) => item.id));
  const backupIsComplete = persistedIds.size === expectedIds.size
    && Array.from(expectedIds).every((applicationId) => persistedIds.has(applicationId));
  if (!backupIsComplete) {
    throw new Error("Could not verify the automatic Firestore backup. The import was not started.");
  }

  // Only a fully verified snapshot is marked ready, and callers must await this before changing live jobs.
  await setDoc(manifestRef, { status: "ready", verifiedAt: new Date().toISOString() }, { merge: true });
  return backup;
}

export function subscribeApplications(
  userId: string,
  onData: (applications: JobApplication[], fromCache: boolean) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    applicationCollection(userId),
    { includeMetadataChanges: true },
    (snapshot) => {
      const applications = snapshot.docs
        .map((item) => deserializeApplication(item.id, item.data()))
        .sort((a, b) => (b.dateApplied || "").localeCompare(a.dateApplied || ""));
      onData(applications, snapshot.metadata.fromCache);
    },
    (error) => onError(error),
  );
}

export async function createApplication(
  userId: string,
  input: Omit<JobApplication, "id" | "activityLog" | "createdAt" | "updatedAt">,
): Promise<JobApplication> {
  const now = new Date().toISOString();
  const sanitizedInput = sanitizeApplicationInput(input);
  const application: JobApplication = {
    ...sanitizedInput,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    activityLog: [{ id: generateId(), date: now, type: "note", message: "Application created" }],
  };
  await setDoc(doc(applicationCollection(userId), application.id), serializeApplication(application));
  return application;
}

export async function updateApplication(userId: string, application: JobApplication): Promise<JobApplication> {
  const updated = { ...application, createdAt: application.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  await setDoc(doc(applicationCollection(userId), updated.id), serializeApplication(updated));
  return updated;
}

export async function deleteApplication(userId: string, applicationId: string): Promise<void> {
  await deleteDoc(doc(applicationCollection(userId), applicationId));
}

async function commitOperations(
  operations: Array<{ type: "set"; application: JobApplication } | { type: "delete"; id: string }>,
  userId: string,
): Promise<void> {
  for (let index = 0; index < operations.length; index += BATCH_OPERATION_LIMIT) {
    const batch = writeBatch(getFirestoreDatabase());
    operations.slice(index, index + BATCH_OPERATION_LIMIT).forEach((operation) => {
      const reference = doc(applicationCollection(userId), operation.type === "set" ? operation.application.id : operation.id);
      if (operation.type === "set") batch.set(reference, serializeApplication(operation.application));
      else batch.delete(reference);
    });
    // Sequential commits make a failed chunk retryable without exceeding Firestore's batch ceiling.
    await batch.commit();
  }
}

export async function replaceApplications(userId: string, applications: JobApplication[]): Promise<void> {
  // Invalid workbooks can parse to zero rows; never turn that failure into an implicit full cloud deletion.
  if (applications.length === 0) throw new Error("Cannot replace applications with an empty dataset.");

  const existing = await getDocs(applicationCollection(userId));
  const now = new Date().toISOString();
  const incomingIds = new Set(applications.map((application) => application.id));
  const operations: Array<{ type: "set"; application: JobApplication } | { type: "delete"; id: string }> = [];

  // Queue replacement rows first so no stale deletion can commit unless every incoming row is durable.
  applications.forEach((application) => operations.push({
    type: "set",
    application: { ...application, createdAt: application.createdAt || now, updatedAt: now },
  }));
  existing.docs.forEach((item) => {
    if (!incomingIds.has(item.id)) operations.push({ type: "delete", id: item.id });
  });
  await commitOperations(operations, userId);
}

export async function upsertApplications(userId: string, applications: JobApplication[]): Promise<void> {
  if (applications.length === 0) return;
  const now = new Date().toISOString();
  // Incremental imports only set additions/explicit-ID updates; they never queue delete operations.
  await commitOperations(applications.map((application) => ({
    type: "set" as const,
    application: { ...application, createdAt: application.createdAt || now, updatedAt: now },
  })), userId);
}

export async function mergeLocalApplicationsOnce(userId: string, localApplications: JobApplication[]): Promise<void> {
  const markerRef = doc(getFirestoreDatabase(), "users", userId, "metadata", "localMigration");
  if ((await getDoc(markerRef)).exists()) return;

  const cloud = await getDocs(applicationCollection(userId));
  const cloudIds = new Set(cloud.docs.map((item) => item.id));
  const now = new Date().toISOString();
  const uniqueLocal = localApplications
    .filter((application) => !cloudIds.has(application.id))
    .map((application) => ({ ...application, createdAt: application.createdAt || now, updatedAt: application.updatedAt || now }));

  await commitOperations(uniqueLocal.map((application) => ({ type: "set" as const, application })), userId);
  // The marker is written last so interrupted uploads remain eligible for a safe idempotent retry.
  await setDoc(markerRef, { completedAt: now, importedCount: uniqueLocal.length });
}
