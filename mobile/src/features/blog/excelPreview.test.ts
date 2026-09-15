import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";
import { excelPage, readExcelPreview } from "./excelPreview";

describe("local Excel preview", () => {
  it.each(["xlsx", "biff8"] as const)("reads %s bytes with multiple sheets and formatted cells", bookType => {
    const book = utils.book_new();
    const sheet = utils.aoa_to_sheet([["Nhân viên", "Lương"], ["An", 1200000]]);
    sheet.B2.z = "#,##0";
    utils.book_append_sheet(book, sheet, "Bảng lương");
    utils.book_append_sheet(book, utils.aoa_to_sheet([["Ghi chú"]]), "Khác");
    const parsed = readExcelPreview(write(book, { type: "base64", bookType }));
    expect(parsed.SheetNames).toEqual(["Bảng lương", "Khác"]);
    expect(excelPage(parsed, "Bảng lương", 0).rows[1]).toEqual(["An", "1,200,000"]);
    expect(excelPage(parsed, "Khác", 0).rows).toEqual([["Ghi chú"]]);
  });
  it("paginates rows and preserves literal text without interpreting markup or links", () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.aoa_to_sheet(Array.from({ length: 51 }, (_, i) => [i === 50 ? "<script>alert(1)</script>" : String(i)])), "Data");
    const parsed = readExcelPreview(write(book, { type: "base64", bookType: "xlsx" }));
    expect(excelPage(parsed, "Data", 0).rows).toHaveLength(50);
    expect(excelPage(parsed, "Data", 1)).toMatchObject({ pages: 2, firstRow: 51, rows: [["<script>alert(1)</script>"]] });
  });
  it("handles empty sheets and limits large sheet ranges", () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, {}, "Empty");
    utils.book_append_sheet(book, { A1: { t: "s", v: "First" }, "!ref": "A1:XFD1048576" }, "Large");
    expect(excelPage(book, "Empty", 0).rows).toEqual([]);
    const page = excelPage(book, "Large", 0);
    expect(page.columns).toHaveLength(200);
    expect(page.rows).toHaveLength(50);
    expect(page.pages).toBe(200);
    expect(page.limited).toBe(true);
  });
});
