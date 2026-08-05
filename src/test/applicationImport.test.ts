import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyConfirmedApplicationImport } from "@/lib/applicationImport";
import { planApplicationImport } from "@/lib/applicationMerge";
import {
  getApplications,
  getDemoApplications,
  getLastImportMetadata,
  getLatestImportBackup,
  saveApplications,
} from "@/lib/storage";
import type { JobApplication } from "@/lib/types";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "ibm-application",
    jobTitle: "Platform Engineer",
    companyName: "IBM",
    location: "Remote",
    currentStatus: "Applied",
    responseStatus: "Applied",
    followUps: false,
    dateApplied: "2026-08-01",
    notes: "",
    followUpDate: "",
    activityLog: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("applyConfirmedApplicationImport", () => {
  it("creates the backup before writing and keeps existing jobs in the merged dataset", async () => {
    const current = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple", dateApplied: "2026-08-05" })];
    const plan = planApplicationImport(current, imported);
    const persistChanges = vi.fn(async () => {
      // Reaching cloud persistence without the IBM snapshot would violate the import safety boundary.
      expect(getLatestImportBackup()?.applications).toMatchObject([{ companyName: "IBM" }]);
    });

    await applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "new-jobs.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      persistChanges,
    });

    expect(persistChanges).toHaveBeenCalledWith(imported);
    expect(getApplications()).toMatchObject([{ companyName: "IBM" }, { companyName: "Apple" }]);
    expect(getLastImportMetadata()).toMatchObject({ fileName: "new-jobs.xlsx", rowCount: 1 });
  });

  it("retains the pre-import dataset when cloud persistence fails", async () => {
    const current = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple", dateApplied: "2026-08-05" })];
    const plan = planApplicationImport(current, imported);
    saveApplications(current);

    await expect(applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "new-jobs.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      persistChanges: async () => {
        throw new Error("cloud unavailable");
      },
    })).rejects.toThrow("cloud unavailable");

    // Failure leaves the current browser dataset and import breadcrumb untouched while retaining the backup.
    expect(getApplications()).toEqual(current);
    expect(getLastImportMetadata()).toBeNull();
    expect(getLatestImportBackup()?.applications).toEqual(current);
  });

  it("keeps signed-out imports and backups isolated from owner storage", async () => {
    const owner = [application({ id: "owner-job", companyName: "Owner Company" })];
    const demoCurrent = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple", dateApplied: "2026-08-05" })];
    const plan = planApplicationImport(demoCurrent, imported);
    saveApplications(owner);

    await applyConfirmedApplicationImport({
      currentApplications: demoCurrent,
      fileName: "demo-jobs.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: ["Interview"] },
      plan,
      persistChanges: vi.fn().mockResolvedValue(undefined),
      storageScope: "demo",
    });

    // The public sandbox receives IBM and Apple while every private owner namespace remains untouched.
    expect(getDemoApplications()).toMatchObject([{ companyName: "IBM" }, { companyName: "Apple" }]);
    expect(getApplications()).toEqual(owner);
    expect(getLatestImportBackup("demo")?.applications).toEqual(demoCurrent);
    expect(getLatestImportBackup("owner")).toBeNull();
    expect(getLastImportMetadata()).toBeNull();
  });
});
