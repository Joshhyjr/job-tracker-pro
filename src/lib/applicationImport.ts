import type { ApplicationImportPlan } from "./applicationMerge";
import {
  createImportBackup,
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

interface ApplyConfirmedImportOptions {
  currentApplications: JobApplication[];
  fileName: string;
  result: WorkbookImportResult;
  plan: ApplicationImportPlan;
  persistChanges: (applications: JobApplication[]) => Promise<void>;
  storageScope?: ImportStorageScope;
}

export async function applyConfirmedApplicationImport({
  currentApplications,
  fileName,
  result,
  plan,
  persistChanges,
  storageScope = "owner",
}: ApplyConfirmedImportOptions): Promise<ImportBackup> {
  // Ordering is deliberate: a verified backup must exist before owner-cloud or demo-browser records can change.
  const backup = createImportBackup(currentApplications, fileName, storageScope);
  await persistChanges([...plan.updates, ...plan.additions]);
  // Browser state and import breadcrumbs advance only after all additive cloud writes succeed.
  if (storageScope === "demo") {
    // Signed-out imports stay inside the public browser sandbox and never alter owner workbook metadata.
    saveDemoApplications(plan.mergedApplications);
    markDemoSeeded();
  } else {
    saveApplications(plan.mergedApplications);
    markSeeded();
    persistWorkbookImport(fileName, result);
  }
  return backup;
}
