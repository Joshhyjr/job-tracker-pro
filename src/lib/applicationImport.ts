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
  persistMerge: (applications: JobApplication[]) => Promise<void>;
  persistReplacement: (applications: JobApplication[]) => Promise<void>;
  storageScope?: ImportStorageScope;
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
}: ApplyConfirmedImportOptions): Promise<ImportBackup> {
  // Ordering is deliberate: a verified owner-cloud or demo-browser backup must exist before records can change.
  const backup = await persistBackup(currentApplications, fileName, mode);
  const nextApplications = mode === "replace" ? result.applications : plan.mergedApplications;
  const persistencePayload = mode === "replace" ? result.applications : [...plan.updates, ...plan.additions];
  // Select persistence inside the transaction so the displayed mode and write semantics cannot drift apart.
  await (mode === "replace" ? persistReplacement : persistMerge)(persistencePayload);
  // Browser state and import breadcrumbs advance only after the selected cloud or demo write succeeds.
  if (storageScope === "demo") {
    // Signed-out imports stay inside the public browser sandbox and never alter owner workbook metadata.
    saveDemoApplications(nextApplications);
    markDemoSeeded();
  } else {
    saveApplications(nextApplications);
    markSeeded();
    persistWorkbookImport(fileName, result);
  }
  return backup;
}
