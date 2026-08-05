const XLSX_EXTENSION = ".xlsx";

export function isSupportedExcelWorkbook(file: File): boolean {
  // ExcelJS reads modern OOXML workbooks; legacy binary .xls files are not supported.
  return file.name.toLowerCase().endsWith(XLSX_EXTENSION);
}
