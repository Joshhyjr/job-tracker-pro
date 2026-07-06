type ExcelJsModule = typeof import("exceljs");

let excelJsPromise: Promise<ExcelJsModule> | null = null;

export function loadExcelJs(): Promise<ExcelJsModule> {
  // Cache the dynamic import so repeat import/export actions reuse the same split chunk.
  excelJsPromise ??= import("exceljs");
  return excelJsPromise;
}
