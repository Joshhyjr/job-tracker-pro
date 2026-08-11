import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgePendingApplicationSync,
  enqueuePendingApplicationSync,
  getPendingApplicationSync,
  overlayPendingApplications,
} from "@/lib/pendingApplicationSync";
import type { JobApplication } from "@/lib/types";

function application(id: string, jobTitle = "Platform Engineer"): JobApplication {
  return {
    id,
    jobTitle,
    companyName: "Beacon Systems",
    location: "Remote",
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-08-11",
    notes: "",
    followUpDate: "",
    activityLog: [],
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pending application sync", () => {
  it("persists additions immediately and overlays them on cloud rows", () => {
    const cloud = [application("cloud-job")];
    const pendingJob = application("pending-job");

    const entries = enqueuePendingApplicationSync("owner-1", [pendingJob], []);
    const visible = overlayPendingApplications(cloud, entries);

    // The import is usable from browser state before Firestore accepts its background write.
    expect(getPendingApplicationSync("owner-1")).toHaveLength(1);
    expect(visible.map((item) => item.id)).toEqual(["cloud-job", "pending-job"]);
  });

  it("keeps owners isolated and acknowledges only the exact attempted entry", () => {
    const first = enqueuePendingApplicationSync("owner-1", [application("job-1")], []);
    enqueuePendingApplicationSync("owner-2", [application("job-2")], []);

    acknowledgePendingApplicationSync("owner-1", [first[0].entryId]);

    // UID-scoped keys prevent a shared browser from leaking or clearing another owner's queue.
    expect(getPendingApplicationSync("owner-1")).toEqual([]);
    expect(getPendingApplicationSync("owner-2").map((entry) => entry.application.id)).toEqual(["job-2"]);
  });

  it("keeps a locally edited unsynchronized addition classified as an addition", () => {
    enqueuePendingApplicationSync("owner-1", [application("pending-job")], []);
    const entries = enqueuePendingApplicationSync("owner-1", [], [application("pending-job", "Senior Platform Engineer")]);

    // Firestore must not require a document to exist for a job that has never completed its first sync.
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ operation: "add", application: { jobTitle: "Senior Platform Engineer" } });
  });

  it("rejects an import when browser storage cannot verify the pending write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });

    // A failed local write is surfaced before the UI can claim that the import was applied.
    expect(() => enqueuePendingApplicationSync("owner-1", [application("pending-job")], []))
      .toThrow("The import was not applied");
  });
});
