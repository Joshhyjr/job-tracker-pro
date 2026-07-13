import { beforeEach, describe, expect, it, vi } from "vitest";
import { deserializeApplication, replaceApplications, serializeApplication } from "@/lib/applicationRepository";
import type { JobApplication } from "@/lib/types";

const firestoreMocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  getFirestoreDatabase: () => ({ name: "test-database" }),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ path: "applications" })),
  deleteDoc: vi.fn(),
  doc: vi.fn((...segments: unknown[]) => ({ id: String(segments[segments.length - 1]) })),
  getDoc: vi.fn(),
  getDocs: firestoreMocks.getDocs,
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
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
  firestoreMocks.writeBatch.mockReset();
});

describe("application repository serialization", () => {
  it("removes undefined optional fields before writing to Firestore", () => {
    const serialized = serializeApplication(application({ salary: undefined, recruiterContactName: "Alex" }));

    // Firestore rejects undefined values, but populated XLSX fields must remain intact.
    expect(serialized).not.toHaveProperty("salary");
    expect(serialized).toMatchObject({ id: "app-1", recruiterContactName: "Alex" });
  });

  it("uses the Firestore document ID as the canonical application ID", () => {
    const restored = deserializeApplication("document-id", serializeApplication(application({ id: "stale-field-id" })));

    // Document paths are the stable identity used by migration, updates, and deletes.
    expect(restored.id).toBe("document-id");
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
