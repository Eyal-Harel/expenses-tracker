import { isHealthClinic, looksLikeDate, newTransaction, normalizeDate, parseAmount, readLogicalRows, type Transaction } from "./common";

// Substring match, not exact: confirmed across real exports that the bank
// reorders both columns AND the words within a description between exports
// (e.g. "5237 - כרטיסי אשראי לי" vs "כרטיסי אשראי לי - 5237"), so match on
// the stable core phrase rather than the exact string.
const IGNORE_DESCRIPTIONS = ["מקס איט פיננסים", "כרטיסי אשראי לי"];

// Tier 0: description -> fixed category. Checked as substring, in order;
// first match wins.
const PATTERN_RULES: [string, string][] = [
  ["העברת שכר דירה", "Rent"],
  ["עמלה", "Bank Fees"],
  ["עמלת", "Bank Fees"],
  ["זיכוי", "Other Credits"],
  ["משכורת", "Salary"],
  ["מילואים", "Reserved Duty"],
  ['דנ"ח ניע תקופתי', "Bank Fees"],
  // Fund-transfer standing orders and forex-purchase fees: money moving
  // between the user's own accounts / minor bank noise, not real spend or
  // income. Reference numbers vary per transaction, so match by substring.
  ["נע-קניה", "Irrelevant"],
  ["נע-מכירה", "Irrelevant"],
  ["רכישת מטח", "Irrelevant"],
];

// Column order is NOT stable across exports (confirmed: the June export has
// these columns in a different order than July's), so columns are located
// by header name each time rather than by fixed position.
const HEADER_DATE = "תאריך";
const HEADER_DESCRIPTION = "תיאור";
const HEADER_CREDIT = "זכות";
const HEADER_DEBIT = "חובה";

interface Columns {
  date: number;
  description: number;
  credit: number;
  debit: number;
}

/** Checks the bank transaction description against the hard-coded pattern
 * rules above (Rent, Salary, Bank Fees, etc.) plus the shared health-clinic
 * check. Returns null if nothing matched, meaning this row falls through to
 * Tier 1 (rules table) / Tier 2 (LLM) in the categorization pipeline. */
export function tier0Category(description: string): string | null {
  if (isHealthClinic(description)) return "Health";
  for (const [pattern, category] of PATTERN_RULES) {
    if (description.includes(pattern)) return category;
  }
  return null;
}

/** True if this is a card-company bill payment (e.g. 'מקס איט פיננסים') —
 * already itemized via the Max/Cal imports, so including it here too would
 * double-count the same spending. */
export function isIgnored(description: string): boolean {
  return IGNORE_DESCRIPTIONS.some((pattern) => description.includes(pattern));
}

/** Locates the header row and returns { rowIndex, columns }. */
export function findColumns(rows: string[][]): { rowIndex: number; columns: Columns } {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim());
    if (cells.includes(HEADER_DATE) && cells.includes(HEADER_DESCRIPTION)) {
      return {
        rowIndex: i,
        columns: {
          date: cells.indexOf(HEADER_DATE),
          description: cells.indexOf(HEADER_DESCRIPTION),
          credit: cells.indexOf(HEADER_CREDIT),
          debit: cells.indexOf(HEADER_DEBIT),
        },
      };
    }
  }
  throw new Error("Could not find the Bank export's header row (expected columns תאריך/תיאור/זכות/חובה)");
}

/** Reads a Bank export CSV end to end: finds the header row (wherever it is,
 * in whatever column order), skips card-bill-payment rows, and turns every
 * remaining data row into a Transaction with Tier 0 categorization already
 * applied where a pattern matched. */
export function parse(content: string): Transaction[] {
  const rows = readLogicalRows(content);
  const { rowIndex: headerRowIndex, columns: cols } = findColumns(rows);
  const transactions: Transaction[] = [];

  for (const row of rows.slice(headerRowIndex + 1)) {
    if (row.length <= Math.max(cols.date, cols.description, cols.credit, cols.debit)) continue;
    const dateField = (row[cols.date] ?? "").trim();
    if (!looksLikeDate(dateField)) continue; // blank / trailing rows

    const description = (row[cols.description] ?? "").trim();
    if (isIgnored(description)) continue; // card-bill payment, already covered by Max/Cal imports

    const credit = parseAmount(row[cols.credit]);
    const debit = parseAmount(row[cols.debit]);
    const amount = credit ? credit : -debit;

    const normalizedDate = normalizeDate(dateField);
    transactions.push(
      newTransaction({
        date: normalizedDate,
        source: "Bank",
        merchant: description,
        amount,
        category: tier0Category(description),
        chargeDate: normalizedDate, // bank transaction date already is the posting/charge date
      }),
    );
  }
  return transactions;
}
