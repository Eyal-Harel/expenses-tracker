import ExcelJS from "exceljs";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((rt) => rt.text).join("");
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("hyperlink" in value) return String(("text" in value && value.text) || value.hyperlink);
    return "";
  }
  return String(value);
}

/** Reads every worksheet in an .xlsx workbook and returns each as CSV text,
 * keyed by sheet name — lets an Excel export be fed straight into the
 * existing CSV-based parsers (bank/cal/max) without changing them at all. */
export async function xlsxSheetsToCSV(buffer: ArrayBuffer): Promise<{ name: string; csv: string }[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook.worksheets.map((worksheet) => {
    const lines: string[] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const values = row.values as ExcelJS.CellValue[]; // 1-indexed; values[0] is unused
      const cells = values.slice(1).map((v) => csvEscape(cellToString(v)));
      lines.push(cells.join(","));
    });
    return { name: worksheet.name, csv: lines.join("\n") };
  });
}
