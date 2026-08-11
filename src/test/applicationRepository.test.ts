import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplicationImportBackup,
  deserializeApplication,
  replaceApplications,
  serializeApplication,
  serializeCompany,
  synchronizeCompanyDirectory,
  upsertApplications,
} from "@/lib/applicationRepository";
import type { JobApplication } from "@/lib/types";

const firestoreMocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getDocFromServer: vi.fn(),
  getDocsFromServer: vi.fn(),
  runTransaction: vi.fn(),
  setDoc: vi.fn(),
  transactionGet: vi.fn(),
  transactionSet: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  getFirestoreDatabase: () => ({ name: "test-database" }),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...segments: unknown[]) => ({
    // Preserve enough path information to distinguish live applications from immutable backup rows.
    path: segments.flatMap((segment) => {
      if (typeof segment === "string") return [segment];
      if (segment && typeof segment === "object" && "path" in segment) return [String(segment.path)];
      return [];
    }).join("/"),
  })),
  deleteDoc: vi.fn(),
  doc: vi.fn((...segments: unknown[]) => ({
    id: String(segments[segments.length - 1]),
    path: segments.flatMap((segment) => {
      if (typeof segment === "string") return [segment];
      if (segment && typeof segment === "object" && "path" in segment) return [String(segment.path)];
      return [];
    }).join("/"),
  })),
  getDoc: firestoreMocks.getDoc,
  getDocFromServer: firestoreMocks.getDocFromServer,
  getDocs: firestoreMocks.getDocs,
  getDocsFromServer: firestoreMocks.getDocsFromServer,
  onSnapshot: vi.fn(),
  runTransaction: firestoreMocks.runTransaction,
  setDoc: firestoreMocks.setDoc,
  writeBatch: firestoreMocks.writeBatch,
}));

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "app-1",
    jobTitle: "Platform Engineer",
    companyName: "Beacon Systems",
    location: "Remote",
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-07-13",
    notes: "",
    followUpDate: "",
    activityLog: [],
    ...overrides,
  };
}

type RecordedOperation = { type: "set" | "delete"; id: string };

function mockBatchedReplacement(existingCount: number, failAtBatch?: number) {
  const committedBatches: RecordedOperation[][] = [];
  let nextBatchIndex = 0;

  firestoreMocks.getDocs.mockResolvedValue({
    docs: Array.from({ length: existingCount }, (_, index) => ({ id: `stale-${index}` })),
  });
  firestoreMocks.writeBatch.mockImplementation(() => {
    const operations: RecordedOperation[] = [];
    const batchIndex = nextBatchIndex++;

    return {
      set: (_reference: unknown, value: JobApplication) => operations.push({ type: "set", id: value.id }),
      delete: (reference: { id: string }) => operations.push({ type: "delete", id: reference.id }),
      commit: async () => {
        if (batchIndex === failAtBatch) throw new Error("simulated batch failure");
        committedBatches.push(operations);
      },
    };
  });

  return committedBatches;
}

beforeEach(() => {
  firestoreMocks.getDoc.mockReset();
  firestoreMocks.getDocs.mockReset();
  firestoreMocks.getDocFromServer.mockReset();
  firestoreMocks.getDocsFromServer.mockReset();
  firestoreMocks.setDoc.mockReset();
  firestoreMocks.runTransaction.mockReset();
  firestoreMocks.transactionGet.mockReset();
  firestoreMocks.transactionSet.mockReset();
  firestoreMocks.writeBatch.mockReset();
  // Scoped-backup and transactional reads default to missing unless a focused test supplies cloud state.
  firestoreMocks.getDocFromServer.mockResolvedValue({ exists: () => false });
  firestoreMocks.transactionGet.mockResolvedValue({ exists: () => false });
  firestoreMocks.runTransaction.mockImplementation(async (_database: unknown, callback: (transaction: unknown) => Promise<void>) => callback({
    get: firestoreMocks.transactionGet,
    set: firestoreMocks.transactionSet,
  }));
});

describe("synchronizeCompanyDirectory", () => {
  it("coalesces realtime re-entry into one batched migration and records completion", async () => {
    const current = Array.from({ length: 108 }, (_, index) => application({ id: `current-${index}` }));
    const committedBatches = mockBatchedReplacement(0);
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => false });

    const first = synchronizeCompanyDirectory("migration-user", current);
    const second = synchronizeCompanyDirectory("migration-user", current);
    await Promise.all([first, second]);

    // A 108-row realtime collection must yield one application batch, not 108 overlapping setDoc cascades.
    expect(firestoreMocks.getDoc).toHaveBeenCalledOnce();
    expect(committedBatches.map((batch) => batch.length)).toEqual([108]);
    const markerCalls = firestoreMocks.setDoc.mock.calls.filter(([reference]) =>
      String((reference as { path?: string }).path).includes("metadata/companyDirectoryV1"));
    expect(markerCalls).toHaveLength(1);
    expect(markerCalls[0][1]).toMatchObject({ applicationCount: 108, version: 1 });
  });

  it("skips all directory writes after the durable migration marker exists", async () => {
    firestoreMocks.getDoc.mockResolvedValue({ exists: () => true });

    await synchronizeCompanyDirectory("completed-migration-user", [application()]);

    // Fresh browser sessions pay for one marker read and never rewrite already-migrated applications.
    expect(firestoreMocks.getDoc).toHaveBeenCalledOnce();
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
  });
});

describe("application repository serialization", () => {
  it("removes undefined optional fields before writing to Firestore", () => {
    const serialized = serializeApplication(application({ salary: undefined, recruiterContactName: "Alex" }));

    // Firestore rejects undefined values, but populated XLSX fields must remain intact.
    expect(serialized).not.toHaveProperty("salary");
    expect(serialized).toMatchObject({ id: "app-1", recruiterContactName: "Alex" });
  });

  it("serializes normalized company rows with the requested database columns", () => {
    const serialized = serializeCompany({
      id: "google",
      name: "google",
      displayName: "Google",
      domain: "google.com",
      logoUrl: "https://www.gstatic.com/google.svg",
      primaryColor: "#4285F4",
      website: "https://www.google.com/",
    });

    // Firestore field names mirror the normalized table contract rather than application display labels.
    expect(serialized).toEqual({
      id: "google",
      name: "google",
      display_name: "Google",
      domain: "google.com",
      logo_url: "https://www.gstatic.com/google.svg",
      primary_color: "#4285F4",
      website: "https://www.google.com/",
    });
  });

  it("uses the Firestore document ID as the canonical application ID", () => {
    const restored = deserializeApplication("document-id", serializeApplication(application({ id: "stale-field-id" })));

    // Document paths are the stable identity used by migration, updates, and deletes.
    expect(restored.id).toBe("document-id");
  });
});

describe("createApplicationImportBackup", () => {
  it("marks a versioned Firestore snapshot ready only after every row is written and verified", async () => {
    const current = Array.from({ length: 451 }, (_, index) => application({ id: `current-${index}` }));
    const committedBatches = mockBatchedReplacement(0);
    firestoreMocks.getDocsFromServer.mockResolvedValue({
      docs: current.map((item) => ({ id: item.id, data: () => serializeApplication(item) })),
    });
    firestoreMocks.getDocs.mockResolvedValue({ docs: current.map((item) => ({ id: item.id })) });

    const backup = await createApplicationImportBackup("user-1", "replacement.xlsx", "replace");

    // Large snapshots use the same conservative batch size as live writes and become recoverable only afterward.
    expect(committedBatches.map((batch) => batch.length)).toEqual([450, 1]);
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(2);
    expect(firestoreMocks.setDoc.mock.calls[0][1]).toMatchObject({
      applicationCount: 451,
      mode: "replace",
      scope: "full",
      sourceFileName: "replacement.xlsx",
      status: "writing",
    });
    expect(firestoreMocks.setDoc.mock.calls[1][1]).toMatchObject({ status: "ready" });
    expect(firestoreMocks.setDoc.mock.calls[1][2]).toEqual({ merge: true });
    expect(backup).toMatchObject({ sourceFileName: "replacement.xlsx", applications: current });
  });

  it("reads and stores only stable-ID update preimages for a merge", async () => {
    const current = [application({ id: "ibm" }), application({ id: "apple" })];
    mockBatchedReplacement(0);
    firestoreMocks.getDocFromServer.mockImplementation(async (reference: { id: string }) => {
      const item = current.find((application) => application.id === reference.id)!;
      return { id: item.id, exists: () => true, data: () => serializeApplication(item) };
    });
    firestoreMocks.getDocs.mockResolvedValue({ docs: [{ id: "ibm" }] });

    const backup = await createApplicationImportBackup("user-1", "updates.xlsx", "merge", ["ibm"]);

    // Apple is untouched, so neither the authoritative read nor the recovery snapshot should include it.
    expect(firestoreMocks.getDocsFromServer).not.toHaveBeenCalled();
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledOnce();
    expect(firestoreMocks.getDocFromServer).toHaveBeenCalledWith(expect.objectContaining({ id: "ibm" }));
    expect(firestoreMocks.setDoc.mock.calls[0][1]).toMatchObject({ applicationCount: 1, mode: "merge", scope: "changes" });
    expect(backup).toMatchObject({ scope: "changes", applications: [expect.objectContaining({ id: "ibm" })] });
  });

  it("rejects an incomplete cloud snapshot without marking it ready", async () => {
    const current = [application({ id: "ibm" }), application({ id: "apple" })];
    mockBatchedReplacement(0);
    firestoreMocks.getDocFromServer.mockImplementation(async (reference: { id: string }) => {
      const item = current.find((application) => application.id === reference.id)!;
      return { id: item.id, exists: () => true, data: () => serializeApplication(item) };
    });
    firestoreMocks.getDocs.mockResolvedValue({ docs: [{ id: "ibm" }] });

    await expect(createApplicationImportBackup("user-1", "merge.xlsx", "merge", current.map((item) => item.id)))
      .rejects.toThrow("Could not verify");

    // The writing manifest can be diagnosed later, but it cannot be mistaken for a valid recovery point.
    expect(firestoreMocks.setDoc).toHaveBeenCalledOnce();
    expect(firestoreMocks.setDoc.mock.calls[0][1]).toMatchObject({ status: "writing" });
  });

  it("rejects duplicate application IDs before creating a manifest", async () => {
    const current = [application({ id: "duplicate" }), application({ id: "duplicate", companyName: "Apple" })];
    firestoreMocks.getDocsFromServer.mockResolvedValue({
      docs: current.map((item) => ({ id: item.id, data: () => serializeApplication(item) })),
    });

    await expect(createApplicationImportBackup("user-1", "replacement.xlsx", "replace"))
      .rejects.toThrow("application IDs are not unique");

    // One Firestore document per job requires unique stable IDs for a complete, verifiable snapshot.
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled();
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });
});

describe("replaceApplications", () => {
  it("rejects empty datasets before reading or deleting cloud records", async () => {
    await expect(replaceApplications("user-1", [])).rejects.toThrow("empty dataset");

    // Clearing all records requires a separate, explicit workflow rather than a malformed workbook.
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });

  it("commits every incoming record before or with stale deletions", async () => {
    const committedBatches = mockBatchedReplacement(500);
    const incoming = Array.from({ length: 500 }, (_, index) => application({ id: `incoming-${index}` }));

    await replaceApplications("user-1", incoming);

    const committedOperations = committedBatches.flat();
    // Exact counts keep this regression test from passing if cleanup is accidentally skipped.
    expect(committedBatches.map((batch) => batch.length)).toEqual([450, 450, 100]);
    expect(committedOperations.filter((operation) => operation.type === "set")).toHaveLength(500);
    expect(committedOperations.filter((operation) => operation.type === "delete")).toHaveLength(500);
    expect(committedOperations.slice(0, incoming.length).every((operation) => operation.type === "set")).toBe(true);
    expect(committedOperations.slice(incoming.length).every((operation) => operation.type === "delete")).toBe(true);
  });

  it("does not commit deletions when a replacement batch fails before all writes finish", async () => {
    const committedBatches = mockBatchedReplacement(500, 1);
    const incoming = Array.from({ length: 500 }, (_, index) => application({ id: `incoming-${index}` }));

    await expect(replaceApplications("user-1", incoming)).rejects.toThrow("simulated batch failure");

    // Firestore batches are atomic, so only the first write-only batch can have reached the cloud.
    expect(committedBatches).toHaveLength(1);
    expect(committedBatches.flat().every((operation) => operation.type === "set")).toBe(true);
  });
});

describe("upsertApplications", () => {
  it("persists the normalized company row before its imported application", async () => {
    await upsertApplications("user-1", [application({ companyName: "IBM" })]);

    // The company table is durable independently of any one job row and uses IBM's canonical identity.
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ibm", path: expect.stringContaining("users/user-1/companies/ibm") }),
      expect.objectContaining({ display_name: "IBM", domain: "ibm.com" }),
      { merge: true },
    );
  });

  it("atomically validates and writes additions and updates without deleting records", async () => {
    const changes = [application({ id: "existing-update" }), application({ id: "new-application" })];
    firestoreMocks.transactionGet
      .mockResolvedValueOnce({ exists: () => true })
      .mockResolvedValueOnce({ exists: () => false });

    await upsertApplications("user-1", [changes[1]], [changes[0]]);

    // The transaction sees the update first and the addition second, then writes both without deletions.
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
    expect(firestoreMocks.transactionSet.mock.calls.map((call) => call[1].id)).toEqual(["existing-update", "new-application"]);
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });

  it("does not open a write batch when every imported row was skipped", async () => {
    await upsertApplications("user-1", []);

    // A duplicate-only workbook remains a successful no-op after confirmation.
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });

  it("rejects an addition whose ID appeared in Firestore after preview", async () => {
    firestoreMocks.transactionGet.mockResolvedValue({ exists: () => true });

    await expect(upsertApplications("user-1", [application({ id: "cross-device-job" })]))
      .rejects.toThrow("another device");

    // A stale browser plan may refresh harmless company metadata, but it cannot overwrite the newer application.
    expect(firestoreMocks.transactionSet).not.toHaveBeenCalled();
  });
});
