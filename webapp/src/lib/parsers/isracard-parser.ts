import { isHealthClinic, looksLikeDate, newTransaction, normalizeDate, parseAmount, readLogicalRows, type Transaction } from "./common";

// IsraCard's own monthly export lays out one or two "blocks" of itemized
// rows in a single sheet, each starting with its own header line:
//  - "עסקאות למועד חיוב" (current-cycle charges) — the normal case. No
//    per-row charge date; the whole block shares one, stated once near the
//    top as e.g. "לחיוב ב-02.07" (day.month, no year — see
//    findStatementChargeDate below).
//  - "עסקאות בחיוב מחוץ למועד" (out-of-cycle adjustments) — only present
//    some months (e.g. a refund posted separately from the main cycle).
//    Distinguished by an extra trailing "חיוב בחשבון הבנק" column giving
//    that row's own real bank-charge date, since these don't share one
//    common date the way the main block does.
// Confirmed against a real (amount-redacted) export.
const HEADER_DATE = "תאריך רכישה";
const HEADER_MERCHANT = "שם בית עסק";
const HEADER_BANK_CHARGE_DATE = "חיוב בחשבון הבנק";

const COL_DATE = 0;
const COL_MERCHANT = 1;
const COL_CHARGE_AMOUNT = 4;
const COL_NOTE = 7;
const COL_BANK_CHARGE_DATE = 8;

// The statement's shared charge date is stated once, near the top, as e.g.
// "לחיוב ב-02.07" — day.month, no year. The year is instead read from the
// statement's own title cell (e.g. "יולי 2026"), since the two always name
// the same month.
const STATEMENT_CHARGE_DATE_RE = /לחיוב ב-(\d{1,2})\.(\d{1,2})/;
const YEAR_RE = /\b(20\d{2})\b/;

/** Finds the statement-wide charge date for the current-cycle block from the
 * header cells near the top of the file, or null if either piece (the
 * "לחיוב ב-" date or a nearby 4-digit year) couldn't be found. */
export function findStatementChargeDate(rows: string[][]): string | null {
  let year: string | null = null;
  let dayMonth: [string, string] | null = null;
  for (const row of rows.slice(0, 10)) {
    for (const cell of row) {
      if (!cell) continue;
      if (!year) {
        const m = YEAR_RE.exec(cell);
        if (m) year = m[1];
      }
      if (!dayMonth) {
        const m = STATEMENT_CHARGE_DATE_RE.exec(cell);
        if (m) dayMonth = [m[1], m[2]];
      }
    }
  }
  if (!year || !dayMonth) return null;
  const [day, month] = dayMonth;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

interface Block {
  headerRow: number;
  hasBankChargeDate: boolean;
}

/** Locates every itemized block in the sheet by its header row (matched by
 * cell content, not a fixed row number, since a statement with nothing
 * out-of-cycle that month only has the first block at all). */
function findBlocks(rows: string[][]): Block[] {
  const blocks: Block[] = [];
  rows.forEach((row, i) => {
    const cells = row.map((c) => (c ?? "").trim());
    if (cells.includes(HEADER_DATE) && cells.includes(HEADER_MERCHANT)) {
      blocks.push({ headerRow: i, hasBankChargeDate: cells.includes(HEADER_BANK_CHARGE_DATE) });
    }
  });
  return blocks;
}

/** Reads an IsraCard export end to end. Every itemized row (in either block)
 * becomes a Transaction. The amount used is always "סכום חיוב" (charge
 * amount, ILS) — confirmed against real refund rows that IsraCard already
 * converts foreign-currency amounts into ILS in this column, unlike Cal, so
 * no separate FX step is needed here. */
export function parse(content: string): Transaction[] {
  const rows = readLogicalRows(content);
  const statementChargeDate = findStatementChargeDate(rows);
  const blocks = findBlocks(rows);
  const transactions: Transaction[] = [];

  for (const block of blocks) {
    for (let i = block.headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      const dateField = (row[COL_DATE] ?? "").trim();
      if (!looksLikeDate(dateField)) break; // blank row ends this block

      const merchant = (row[COL_MERCHANT] ?? "").trim();
      const amount = parseAmount(row[COL_CHARGE_AMOUNT]);
      const note = (row[COL_NOTE] ?? "").trim() || null;
      const bankChargeDateField = block.hasBankChargeDate ? (row[COL_BANK_CHARGE_DATE] ?? "").trim() : "";
      const chargeDate = looksLikeDate(bankChargeDateField) ? normalizeDate(bankChargeDateField) : statementChargeDate;

      transactions.push(
        newTransaction({
          date: normalizeDate(dateField),
          source: "IsraCard",
          merchant,
          amount,
          category: isHealthClinic(merchant) ? "Health" : null,
          hint: note,
          chargeDate,
        }),
      );
    }
  }
  return transactions;
}
