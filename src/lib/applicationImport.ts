import type { ApplicationImportPlan } from "./applicationMerge";
import {
  markDemoSeeded,
  markSeeded,
  persistWorkbookImport,
  saveApplications,
  saveDemoApplications,
  type ImportBackup,
  type ImportStorageScope,
  type WorkbookImportResult,
} from "./storage";
import type { JobApplication } from "./types";

export type ApplicationImportMode = "merge" | "replace";

interface ApplyConfirmedImportOptions {
  currentApplications: JobApplication[];
  fileName: string;
  result: WorkbookImportResult;
  plan: ApplicationImportPlan;
  mode?: ApplicationImportMode;
  persistBackup: (
    applications: JobApplication[],
    fileName: string,
    mode: ApplicationImportMode,
  ) => Promise<ImportBackup>;
  persistMerge: (additions: JobApplication[], updates: JobApplication[]) => Promise<void>;
  persistReplacement: (applications: JobApplication[]) => Promise<void>;
  storageScope?: ImportStorageScope;
  ownerId?: string;
}

export async function applyConfirmedApplicationImport({
  currentApplications,
  fileName,
  result,
  plan,
  mode = "merge",
  persistBackup,
  persistMerge,
  persistReplacement,
  storageScope = "owner",
  ownerId,
}: ApplyConfirmedImportOptions): Promise<ImportBackup | null> {
  const updatedIds = new Set(plan.updates.map((application) => application.id));
  // Additions cannot damage current jobs; only replacement and stable-ID updates need pre-write recovery data.
  const applicationsToBackup = mode === "replace"
    ? currentApplications
    : currentApplications.filter((application) => updatedIds.has(application.id));
  // Ordering remains deliberate whenever current records can change: verify their preimages before persistence.
  const backup = applicationsToBackup.length > 0
    ? await persistBackup(applicationsToBackup, fileName, mode)
    : null;
  const nextApplications = mode === "replace" ? result.applications : plan.mergedApplications;
  if (mode === "replace") {
    // Replacement keeps its full-dataset writer behind the verified snapshot boundary.
    await persistReplacement(result.applications);
  } else {
    // Preserve the plan split so Firestore can reject a cross-device ID collision before an addition overwrites it.
    await persistMerge(plan.additions, plan.updates);
  }
  // Browser state and import breadcrumbs advance only after the selected cloud or demo write succeeds.
  if (storageScope === "demo") {
    // Signed-out imports stay inside the public browser sandbox and never alter owner workbook metadata.
    saveDemoApplications(nextApplications);
    markDemoSeeded();
  } else {
    // Authenticated browser caches stay isolated when more than one account uses the same device.
    saveApplications(nextApplications, ownerId);
    markSeeded();
    persistWorkbookImport(fileName, result);
  }
  return backup;
}
