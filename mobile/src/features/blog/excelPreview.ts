import { read, utils, type WorkBook } from "xlsx";

export const EXCEL_ROW_LIMIT = 10000;
export const EXCEL_COLUMN_LIMIT = 200;
export const EXCEL_PAGE_SIZE = 50;

export function readExcelPreview(base64: string): WorkBook {
  const workbook = read(base64, { type: "base64", sheetRows: EXCEL_ROW_LIMIT, cellHTML: false, cellFormula: false });
  if (!workbook.SheetNames.length) throw new Error("Tệp Excel không có trang tính.");
  return workbook;
}

export function excelPage(workbook: WorkBook, name: string, page: number) {
  const sheet = workbook.Sheets[name];
  const ref = sheet?.["!ref"];
  if (!ref) return { columns: [] as string[], rows: [] as string[][], pages: 1, limited: false, firstRow: 1 };
  const range = utils.decode_range(ref);
  const fullRange = utils.decode_range(sheet["!fullref"] || ref);
  const endRow = Math.min(range.e.r, EXCEL_ROW_LIMIT - 1);
  const endColumn = Math.min(range.e.c, range.s.c + EXCEL_COLUMN_LIMIT - 1);
  const pages = Math.max(1, Math.ceil((endRow - range.s.r + 1) / EXCEL_PAGE_SIZE));
  const firstRow = range.s.r + Math.max(0, Math.min(page, pages - 1)) * EXCEL_PAGE_SIZE;
  const columns = Array.from({ length: endColumn - range.s.c + 1 }, (_, i) => utils.encode_col(range.s.c + i));
  const rows: string[][] = [];
  for (let r = firstRow; r <= Math.min(endRow, firstRow + EXCEL_PAGE_SIZE - 1); r++) {
    rows.push(columns.map((_, i) => {
      const cell = sheet[utils.encode_cell({ r, c: range.s.c + i })];
      return cell ? String(utils.format_cell(cell)) : "";
    }));
  }
  return { columns, rows, pages, firstRow: firstRow + 1,
    limited: fullRange.e.r >= EXCEL_ROW_LIMIT || fullRange.e.c > endColumn };
}
