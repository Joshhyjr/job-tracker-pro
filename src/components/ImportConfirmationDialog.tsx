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

interface ImportConfirmationDialogProps {
  open: boolean;
  fileName: string;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  isApplying: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export default function ImportConfirmationDialog({
  open,
  fileName,
  addedCount,
  updatedCount,
  skippedCount,
  isApplying,
  onCancel,
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
          <AlertDialogTitle>Confirm spreadsheet merge</AlertDialogTitle>
          <AlertDialogDescription>
            Review the changes from {fileName} before anything is written.
          </AlertDialogDescription>
        </AlertDialogHeader>

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
          <p className="mt-1 text-muted-foreground">A browser backup of the current dataset will be created before this merge starts.</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isApplying}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isApplying}
            onClick={(event) => {
              // Keep the dialog open until the backup and cloud writes both succeed.
              event.preventDefault();
              void onConfirm();
            }}
          >
            {isApplying ? "Merging..." : "Back up and merge"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
