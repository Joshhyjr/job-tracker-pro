import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ApplicationImportMode } from "@/lib/applicationImport";
import { cn } from "@/lib/utils";

interface ImportConfirmationDialogProps {
  open: boolean;
  fileName: string;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  currentCount: number;
  importedCount: number;
  backupDestination: "firestore" | "browser";
  mode: ApplicationImportMode;
  isApplying: boolean;
  onCancel: () => void;
  onModeChange: (mode: ApplicationImportMode) => void;
  onConfirm: () => Promise<void>;
}

export default function ImportConfirmationDialog({
  open,
  fileName,
  addedCount,
  updatedCount,
  skippedCount,
  currentCount,
  importedCount,
  backupDestination,
  mode,
  isApplying,
  onCancel,
  onModeChange,
  onConfirm,
}: ImportConfirmationDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Escape, overlay, and Cancel all use one guarded close path while a cloud merge is pending.
        if (!nextOpen && !isApplying) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Choose how to import this spreadsheet</AlertDialogTitle>
          <AlertDialogDescription>
            Review {fileName} and choose whether to preserve or replace the current dataset.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={mode}
          disabled={isApplying}
          onValueChange={(value) => {
            // Accept only the two rendered choices if the underlying primitive ever emits an unexpected value.
            if (value === "merge" || value === "replace") onModeChange(value);
          }}
          aria-label="Spreadsheet import mode"
          className="gap-3"
        >
          <Label
            htmlFor="import-mode-merge"
            className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-4", mode === "merge" && "border-primary bg-primary/5")}
          >
            <RadioGroupItem id="import-mode-merge" value="merge" className="mt-0.5" />
            <span>
              <span className="block font-medium">Back up and merge</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">Keep every current job, add new rows, update stable-ID matches, and skip duplicates.</span>
            </span>
          </Label>
          <Label
            htmlFor="import-mode-replace"
            className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-4", mode === "replace" && "border-destructive bg-destructive/5")}
          >
            <RadioGroupItem id="import-mode-replace" value="replace" className="mt-0.5" />
            <span>
              <span className="block font-medium">Back up and replace</span>
              <span className="mt-1 block text-sm font-normal text-muted-foreground">Use only the jobs in this workbook as the active dataset.</span>
            </span>
          </Label>
        </RadioGroup>

        {mode === "merge" ? (
          <>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border p-3">
                <dt className="text-xs text-muted-foreground">New jobs</dt>
                <dd className="text-xl font-semibold text-primary">{addedCount}</dd>
              </div>
              <div className="rounded-md border p-3">
                <dt className="text-xs text-muted-foreground">Updated by ID</dt>
                <dd className="text-xl font-semibold">{updatedCount}</dd>
              </div>
              <div className="rounded-md border p-3">
                <dt className="text-xs text-muted-foreground">Duplicates skipped</dt>
                <dd className="text-xl font-semibold">{skippedCount}</dd>
              </div>
            </dl>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">Your current jobs will not be deleted.</p>
              <p className="mt-1 text-muted-foreground">
                {/* Owner recovery points are cross-device; demo recovery points cannot enter private Firestore. */}
                {backupDestination === "firestore"
                  ? "A verified owner-only Firestore backup will be created before this merge starts."
                  : "A browser backup of the demo dataset will be created before this merge starts."}
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">This will replace all {currentCount} current jobs with {importedCount} jobs from the workbook.</p>
            <p className="mt-1 text-muted-foreground">
              Current jobs that are not in the workbook will be removed from the active dataset.{" "}
              {backupDestination === "firestore"
                ? "An owner-only Firestore backup will be verified before replacement starts."
                : "A browser backup of the demo dataset will be verified before replacement starts."}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isApplying}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isApplying}
            onClick={(event) => {
              // Keep the dialog open until the backup and selected persistence transaction both succeed.
              event.preventDefault();
              void onConfirm();
            }}
            className={mode === "replace" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {isApplying ? (mode === "replace" ? "Replacing..." : "Merging...") : (mode === "replace" ? "Back up and replace" : "Back up and merge")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
