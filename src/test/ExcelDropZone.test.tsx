import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ExcelDropZone from "@/components/ExcelDropZone";

describe("ExcelDropZone", () => {
  it("imports one dropped XLSX workbook", async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const file = new File(["workbook"], "applications.XLSX", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    render(<ExcelDropZone onImport={onImport} />);

    // Drag/drop accepts the extension case-insensitively because desktop file systems can preserve uppercase names.
    fireEvent.drop(screen.getByTestId("excel-drop-zone"), { dataTransfer: { files: [file] } });

    await waitFor(() => expect(onImport).toHaveBeenCalledWith(file));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("rejects non-XLSX files before importing", () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const file = new File(["plain text"], "applications.csv", { type: "text/csv" });
    render(<ExcelDropZone onImport={onImport} />);

    fireEvent.drop(screen.getByTestId("excel-drop-zone"), { dataTransfer: { files: [file] } });

    expect(screen.getByRole("alert")).toHaveTextContent("Only .xlsx Excel workbooks are supported.");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("rejects multiple files in one drop", () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const files = [new File(["one"], "one.xlsx"), new File(["two"], "two.xlsx")];
    render(<ExcelDropZone onImport={onImport} />);

    fireEvent.drop(screen.getByTestId("excel-drop-zone"), { dataTransfer: { files } });

    expect(screen.getByRole("alert")).toHaveTextContent("Drop one .xlsx Excel workbook at a time.");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("uses the compact drop-zone presentation", () => {
    render(<ExcelDropZone onImport={vi.fn().mockResolvedValue(undefined)} />);

    // The signed-in and signed-out layouts share the same deliberately small import prompt.
    expect(screen.getByText("Drag and drop an Excel workbook")).toHaveClass("text-sm");
    expect(screen.getByText("One .xlsx file, up to 10 MB")).toHaveClass("text-xs");
    expect(screen.getByTestId("excel-drop-zone")).toHaveClass("px-3", "py-2.5", "mb-4");
  });
});
