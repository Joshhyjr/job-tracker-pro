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
import { enrichApplicationCompanyBranding } from "@/lib/companyLogos";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  // Fixtures model the same branding enrichment applied at every production persistence boundary.
  return enrichApplicationCompanyBranding({
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
  });
}

beforeEach(() => {
  localStorage.clear();
});

function persistBrowserBackup(scope: "owner" | "demo" = "owner") {
  // The import coordinator accepts either the owner Firestore writer or the isolated demo browser writer.
  return vi.fn(async (applications: JobApplication[], fileName: string, mode: "merge" | "replace") =>
    createImportBackup(applications, fileName, scope, mode === "replace" ? "full" : "changes"));
}

describe("applyConfirmedApplicationImport", () => {
  it("adds new jobs without backing up unchanged current records", async () => {
    const current = [application()];
    const imported = [application({ id: "apple-application", companyName: "Apple", dateApplied: "2026-08-05" })];
    const plan = planApplicationImport(current, imported);
    const persistMerge = vi.fn(async () => {
      // Pure additions cannot overwrite IBM, so the fast path reaches persistence without a recovery snapshot.
      expect(getLatestImportBackup()).toBeNull();
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

    // The coordinator preserves additions separately from protected stable-ID updates.
    expect(persistMerge).toHaveBeenCalledWith(imported, []);
    expect(persistBackup).not.toHaveBeenCalled();
    expect(persistReplacement).not.toHaveBeenCalled();
    expect(getApplications()).toMatchObject([{ companyName: "IBM" }, { companyName: "Apple" }]);
    expect(getLastImportMetadata()).toMatchObject({ fileName: "new-jobs.xlsx", rowCount: 1 });
  });

  it("retains the pre-import dataset when cloud persistence fails", async () => {
    const current = [application()];
    const imported = [application({ jobTitle: "Senior Platform Engineer" })];
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

    // Failure leaves the current browser dataset untouched and retains only the overwritten IBM preimage.
    expect(getApplications()).toEqual(current);
    expect(getLastImportMetadata()).toBeNull();
    expect(getLatestImportBackup()?.applications).toEqual(current);
    expect(getLatestImportBackup()?.scope).toBe("changes");
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

    // Additions need no demo backup; the public sandbox receives IBM and Apple without touching owner storage.
    expect(getDemoApplications()).toMatchObject([{ companyName: "IBM" }, { companyName: "Apple" }]);
    expect(getApplications()).toEqual(owner);
    expect(getLatestImportBackup("demo")).toBeNull();
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

  it("does not start replacement when its required full backup fails", async () => {
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

    // Full backup readiness remains the hard transaction boundary for destructive replacement.
    expect(persistMerge).not.toHaveBeenCalled();
    expect(persistReplacement).not.toHaveBeenCalled();
  });

  it("does not update a stable-ID match when its scoped backup fails", async () => {
    const current = [application()];
    const imported = [application({ jobTitle: "Senior Platform Engineer" })];
    const plan = planApplicationImport(current, imported);
    const persistMerge = vi.fn();

    await expect(applyConfirmedApplicationImport({
      currentApplications: current,
      fileName: "updates.xlsx",
      result: { applications: imported, warnings: [], preferredResponseStatusOrder: [] },
      plan,
      persistBackup: vi.fn().mockRejectedValue(new Error("Scoped backup unavailable")),
      persistMerge,
      persistReplacement: vi.fn(),
    })).rejects.toThrow("Scoped backup unavailable");

    // Stable-ID updates remain blocked until the exact records they can overwrite are recoverable.
    expect(persistMerge).not.toHaveBeenCalled();
  });
});
