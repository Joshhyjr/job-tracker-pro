import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImportConfirmationDialog from "@/components/ImportConfirmationDialog";

const summaryProps = {
  open: true,
  fileName: "applications.xlsx",
  addedCount: 3,
  updatedCount: 1,
  skippedCount: 2,
  isApplying: false,
};

describe("ImportConfirmationDialog", () => {
  it("shows the merge summary and cancels without confirming", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ImportConfirmationDialog {...summaryProps} onCancel={onCancel} onConfirm={onConfirm} />);

    // The safety promise and all three counts must be visible before the user can approve the import.
    expect(screen.getByText("Your current jobs will not be deleted.")).toBeInTheDocument();
    expect(screen.getByText("A browser backup of the current dataset will be created before this merge starts.")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
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
});
