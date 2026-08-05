import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSupportedExcelWorkbook } from "@/lib/excelFile";
import { cn } from "@/lib/utils";

export default function ExcelDropZone({ onImport }: { onImport: (file: File) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");

  async function importFile(file: File) {
    if (!isSupportedExcelWorkbook(file)) {
      setError("Only .xlsx Excel workbooks are supported.");
      return;
    }

    setError("");
    setIsImporting(true);
    try {
      await onImport(file);
    } finally {
      setIsImporting(false);
    }
  }

  function handleDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isImporting) setIsDragging(event.type === "dragenter" || event.type === "dragover");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (isImporting) return;

    const files = Array.from(event.dataTransfer.files);
    if (files.length !== 1) {
      setError("Drop one .xlsx Excel workbook at a time.");
      return;
    }

    void importFile(files[0]);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void importFile(file);
    // Reset the picker so selecting the same workbook again still triggers an import.
    event.target.value = "";
  }

  return (
    <div
      data-testid="excel-drop-zone"
      className={cn(
        "mb-4 rounded-lg border border-dashed px-3 py-2.5 transition-colors",
        isDragging ? "border-primary bg-primary/10" : "border-border bg-card/60",
        isImporting && "pointer-events-none opacity-70",
      )}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="rounded-full bg-primary/10 p-1.5 text-primary" aria-hidden="true">
            <FileSpreadsheet className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Drag and drop an Excel workbook</p>
            <p className="text-xs text-muted-foreground">One .xlsx file, up to 10 MB</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={isImporting} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {isImporting ? "Importing..." : "Choose workbook"}
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {/* Restrict the native picker as well as validating files from both picker and drop events. */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        aria-label="Choose an XLSX workbook"
        onChange={handleFileChange}
      />
    </div>
  );
}
