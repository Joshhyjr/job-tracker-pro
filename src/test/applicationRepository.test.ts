import { describe, expect, it } from "vitest";
import { deserializeApplication, serializeApplication } from "@/lib/applicationRepository";
import type { JobApplication } from "@/lib/types";

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
