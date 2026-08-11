import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createApplicationImportBackup,
  deserializeApplication,
  replaceApplications,
  serializeApplication,
  serializeCompany,
  upsertApplications,
} from "@/lib/applicationRepository";
import type { JobApplication } from "@/lib/types";

const firestoreMocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  setDoc: vi.fn(),
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
  getDoc: vi.fn(),
  getDocs: firestoreMocks.getDocs,
  getDocsFromServer: firestoreMocks.getDocsFromServer,
  onSnapshot: vi.fn(),
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
  firestoreMocks.getDocs.mockReset();
  firestoreMocks.getDocsFromServer.mockReset();
  firestoreMocks.setDoc.mockReset();
  firestoreMocks.writeBatch.mockReset();
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
      sourceFileName: "replacement.xlsx",
      status: "writing",
    });
    expect(firestoreMocks.setDoc.mock.calls[1][1]).toMatchObject({ status: "ready" });
    expect(firestoreMocks.setDoc.mock.calls[1][2]).toEqual({ merge: true });
    expect(backup).toMatchObject({ sourceFileName: "replacement.xlsx", applications: current });
  });

  it("rejects an incomplete cloud snapshot without marking it ready", async () => {
    const current = [application({ id: "ibm" }), application({ id: "apple" })];
    mockBatchedReplacement(0);
    firestoreMocks.getDocsFromServer.mockResolvedValue({
      docs: current.map((item) => ({ id: item.id, data: () => serializeApplication(item) })),
    });
    firestoreMocks.getDocs.mockResolvedValue({ docs: [{ id: "ibm" }] });

    await expect(createApplicationImportBackup("user-1", "merge.xlsx", "merge"))
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

    await expect(createApplicationImportBackup("user-1", "merge.xlsx", "merge"))
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
    mockBatchedReplacement(0);

    await upsertApplications("user-1", [application({ companyName: "IBM" })]);

    // The company table is durable independently of any one job row and uses IBM's canonical identity.
    expect(firestoreMocks.setDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ibm", path: expect.stringContaining("users/user-1/companies/ibm") }),
      expect.objectContaining({ display_name: "IBM", domain: "ibm.com" }),
      { merge: true },
    );
  });

  it("writes additions and updates without reading or deleting existing records", async () => {
    const committedBatches = mockBatchedReplacement(500);
    const changes = [application({ id: "existing-update" }), application({ id: "new-application" })];

    await upsertApplications("user-1", changes);

    // Incremental import has no stale-record cleanup phase, so unrelated cloud jobs cannot be deleted.
    expect(firestoreMocks.getDocs).not.toHaveBeenCalled();
    expect(committedBatches.flat()).toEqual([
      { type: "set", id: "existing-update" },
      { type: "set", id: "new-application" },
    ]);
    expect(committedBatches.flat().some((operation) => operation.type === "delete")).toBe(false);
  });

  it("does not open a write batch when every imported row was skipped", async () => {
    await upsertApplications("user-1", []);

    // A duplicate-only workbook remains a successful no-op after confirmation.
    expect(firestoreMocks.writeBatch).not.toHaveBeenCalled();
  });
});
