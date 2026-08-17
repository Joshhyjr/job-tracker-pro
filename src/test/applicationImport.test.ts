import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyConfirmedApplicationImport } from "@/lib/applicationImport";
import { planApplicationImport } from "@/lib/applicationMerge";
import {
  createImportBackup,
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
    // Import fixtures reflect the normalized work-mode migration applied at browser/cloud read boundaries.
    workMode: "Remote",
    locationStatus: "work_mode_only",
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

function persistBrowserBackup(scope: "owner" | "demo" = "owner") {
  // The import coordinator accepts either the owner Firestore writer or the isolated demo browser writer.
  return vi.fn(async (applications: JobApplication[], fileName: string) => createImportBackup(applications, fileName, scope));
}

describe("applyConfirmedApplicationImport", () => {
  it("creates the backup before writing and keeps existing jobs in the merged dataset", async () => {
    const current = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple", dateApplied: "2026-08-05" })];
    const plan = planApplicationImport(current, imported);
    const persistMerge = vi.fn(async () => {
      // Reaching cloud persistence without the IBM snapshot would violate the import safety boundary.
      expect(getLatestImportBackup()?.applications).toMatchObject([{ companyName: "IBM" }]);
    });
    const persistReplacement = vi.fn();
    const persistBackup = persistBrowserBackup();

    await applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "new-jobs.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      persistBackup,
      persistMerge,
      persistReplacement,
    });

    expect(persistMerge).toHaveBeenCalledWith(imported);
    expect(persistBackup).toHaveBeenCalledWith(current, "new-jobs.xlsx", "merge");
    expect(persistReplacement).not.toHaveBeenCalled();
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
      persistBackup: persistBrowserBackup(),
      persistMerge: async () => {
        throw new Error("cloud unavailable");
      },
      persistReplacement: vi.fn(),
    })).rejects.toThrow("cloud unavailable");

    // Failure leaves the current browser dataset and import breadcrumb untouched while retaining the backup.
    expect(getApplications()).toEqual(current);
    expect(getLastImportMetadata()).toBeNull();
    expect(getLatestImportBackup()?.applications).toEqual(current);
  });

  it("backs up the current dataset before replacing it with workbook rows", async () => {
    const current = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple", dateApplied: "2026-08-05" })];
    const plan = planApplicationImport(current, imported);
    saveApplications(current);
    const persistReplacement = vi.fn(async (replacement: JobApplication[]) => {
      // Replacement cannot begin until the recoverable IBM snapshot has been verified.
      expect(getLatestImportBackup()?.applications).toEqual(current);
      expect(replacement).toEqual(imported);
    });
    const persistMerge = vi.fn();
    const persistBackup = persistBrowserBackup();

    await applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "replacement.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      mode: "replace",
      persistBackup,
      persistMerge,
      persistReplacement,
    });

    expect(persistReplacement).toHaveBeenCalledWith(imported);
    expect(persistBackup).toHaveBeenCalledWith(current, "replacement.xlsx", "replace");
    expect(persistMerge).not.toHaveBeenCalled();
    expect(getApplications()).toEqual(imported);
    expect(getLatestImportBackup()?.applications).toEqual(current);
    expect(getLastImportMetadata()).toMatchObject({ fileName: "replacement.xlsx", rowCount: 1 });
  });

  it("rejects duplicate replacement IDs before backup or persistence begins", async () => {
    const current = [application()];
    const imported = [
      application({ id: "duplicate-id", companyName: "Apple" }),
      application({ id: " duplicate-id ", companyName: "Microsoft" }),
    ];
    const plan = planApplicationImport(current, imported);
    const persistBackup = vi.fn();
    const persistMerge = vi.fn();
    const persistReplacement = vi.fn();
    saveApplications(current);

    await expect(applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "duplicate-ids.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      mode: "replace",
      persistBackup,
      persistMerge,
      persistReplacement,
    })).rejects.toThrow("duplicate Application IDs");

    // Validation precedes every import side effect, so the current dataset and breadcrumbs remain untouched.
    expect(persistBackup).not.toHaveBeenCalled();
    expect(persistMerge).not.toHaveBeenCalled();
    expect(persistReplacement).not.toHaveBeenCalled();
    expect(getApplications()).toEqual(current);
    expect(getLatestImportBackup()).toBeNull();
    expect(getLastImportMetadata()).toBeNull();
  });

  it("rejects invalid replacement path IDs before backup or persistence begins", async () => {
    const current = [application()];
    const imported = [application({ id: "folder/application", companyName: "Apple" })];
    const plan = planApplicationImport(current, imported);
    const persistBackup = vi.fn();
    const persistMerge = vi.fn();
    const persistReplacement = vi.fn();
    saveApplications(current);

    await expect(applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "invalid-id.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      mode: "replace",
      persistBackup,
      persistMerge,
      persistReplacement,
    })).rejects.toThrow("cannot be blank or contain '/'");

    // A path-invalid row fails before the verified-backup transaction or local import breadcrumbs begin.
    expect(persistBackup).not.toHaveBeenCalled();
    expect(persistMerge).not.toHaveBeenCalled();
    expect(persistReplacement).not.toHaveBeenCalled();
    expect(getApplications()).toEqual(current);
    expect(getLatestImportBackup()).toBeNull();
    expect(getLastImportMetadata()).toBeNull();
  });

  it("keeps the current dataset active when replacement persistence fails", async () => {
    const current = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple" })];
    const plan = planApplicationImport(current, imported);
    saveApplications(current);

    await expect(applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "replacement.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      mode: "replace",
      persistBackup: persistBrowserBackup(),
      persistMerge: vi.fn(),
      persistReplacement: async () => {
        throw new Error("cloud unavailable");
      },
    })).rejects.toThrow("cloud unavailable");

    // A failed replacement leaves IBM active and retains its verified recovery snapshot.
    expect(getApplications()).toEqual(current);
    expect(getLatestImportBackup()?.applications).toEqual(current);
    expect(getLastImportMetadata()).toBeNull();
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
      persistBackup: persistBrowserBackup("demo"),
      persistMerge: vi.fn().mockResolvedValue(undefined),
      persistReplacement: vi.fn(),
      storageScope: "demo",
    });

    // The public sandbox receives IBM and Apple while every private owner namespace remains untouched.
    expect(getDemoApplications()).toMatchObject([{ companyName: "IBM" }, { companyName: "Apple" }]);
    expect(getApplications()).toEqual(owner);
    expect(getLatestImportBackup("demo")?.applications).toEqual(demoCurrent);
    expect(getLatestImportBackup("owner")).toBeNull();
    expect(getLastImportMetadata()).toBeNull();
  });

  it("replaces only the signed-out demo dataset when demo replacement is selected", async () => {
    const owner = [application({ id: "owner-job", companyName: "Owner Company" })];
    const demoCurrent = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple" })];
    const plan = planApplicationImport(demoCurrent, imported);
    saveApplications(owner);

    await applyConfirmedApplicationImport({
      currentApplications: demoCurrent,
      fileName: "demo-replacement.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      mode: "replace",
      persistBackup: persistBrowserBackup("demo"),
      persistMerge: vi.fn(),
      persistReplacement: vi.fn().mockResolvedValue(undefined),
      storageScope: "demo",
    });

    // Demo replacement removes IBM only from the sandbox and never writes owner import metadata.
    expect(getDemoApplications()).toEqual(imported);
    expect(getApplications()).toEqual(owner);
    expect(getLatestImportBackup("demo")?.applications).toEqual(demoCurrent);
    expect(getLastImportMetadata()).toBeNull();
  });

  it("does not start merge or replacement when the required cloud backup fails", async () => {
    const current = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple" })];
    const plan = planApplicationImport(current, imported);
    const persistMerge = vi.fn();
    const persistReplacement = vi.fn();

    await expect(applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "new-jobs.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      mode: "replace",
      persistBackup: vi.fn().mockRejectedValue(new Error("Firestore backup unavailable")),
      persistMerge,
      persistReplacement,
    })).rejects.toThrow("Firestore backup unavailable");

    // Backup readiness is the hard transaction boundary for both safe import modes.
    expect(persistMerge).not.toHaveBeenCalled();
    expect(persistReplacement).not.toHaveBeenCalled();
  });
});
