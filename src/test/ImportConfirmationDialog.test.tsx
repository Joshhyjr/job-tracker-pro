import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImportConfirmationDialog from "@/components/ImportConfirmationDialog";

const summaryProps = {
  open: true,
  fileName: "applications.xlsx",
  addedCount: 3,
  updatedCount: 1,
  skippedCount: 2,
  currentCount: 8,
  importedCount: 4,
  backupDestination: "firestore" as const,
  mode: "merge" as const,
  isApplying: false,
  onModeChange: vi.fn(),
};

describe("ImportConfirmationDialog", () => {
  it("shows the merge summary and cancels without confirming", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ImportConfirmationDialog {...summaryProps} onCancel={onCancel} onConfirm={onConfirm} />);

    // The safety promise and all three counts must be visible before the user can approve the import.
    expect(screen.getByText("Your current jobs will not be deleted.")).toBeInTheDocument();
    expect(screen.getByText("A verified owner-only Firestore backup will be created before this merge starts.")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /back up and merge/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /back up and replace/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("starts the backup-and-merge action only after confirmation", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ImportConfirmationDialog {...summaryProps} onCancel={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Back up and merge" }));

    // Preventing the default dialog close leaves the parent in control until persistence succeeds.
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("lets the user select full replacement before confirming", () => {
    const onModeChange = vi.fn();
    render(<ImportConfirmationDialog {...summaryProps} onCancel={vi.fn()} onModeChange={onModeChange} onConfirm={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.click(screen.getByRole("radio", { name: /back up and replace/i }));

    expect(onModeChange).toHaveBeenCalledWith("replace");
  });

  it("clearly warns about removals and confirms replacement", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ImportConfirmationDialog {...summaryProps} mode="replace" onCancel={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText("This will replace all 8 current jobs with 4 jobs from the workbook.")).toBeInTheDocument();
    expect(screen.getByText(/Current jobs that are not in the workbook will be removed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back up and replace" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("explains that signed-out demo recovery remains browser-local", () => {
    render(
      <ImportConfirmationDialog
        {...summaryProps}
        backupDestination="browser"
        onCancel={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Demo imports cannot write into the allowlisted owner's Firestore account.
    expect(screen.getByText("A browser backup of the demo dataset will be created before this merge starts.")).toBeInTheDocument();
  });
});
