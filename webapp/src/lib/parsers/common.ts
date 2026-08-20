import { parse as parseCsv } from "csv-parse/sync";

const DATE_RE = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/;

// Shared across sources: a merchant name containing one of these is a medical
// clinic, regardless of which specific clinic — catches new ones on first
// sight instead of needing the LLM (and then a rules-table entry) every time.
const HEALTH_CLINIC_MARKERS = ["מרפאת", "מרפאה"];

export function isHealthClinic(merchant: string): boolean {
  return HEALTH_CLINIC_MARKERS.some((marker) => merchant.includes(marker));
}

// The one common shape every source parser (bank/cal/max) produces,
// regardless of how different each raw export's format is. Everything
// downstream of parsing — categorization, writing to the database — only
// ever deals with this shape, never the source-specific raw rows.
export interface Transaction {
  date: string; // normalized YYYY-MM-DD, deal/transaction date (when the purchase happened)
  source: "Max" | "Cal" | "Bank";
  merchant: string; // merchant name, or description for Bank rows
  amount: number;
  category: string | null;
  needsReview: boolean;
  doneBy: "Script" | "AI" | "Manual" | null;
  hint: string | null; // source's own category label, e.g. Max's "קטגוריה" column; used by the pipeline, never persisted
  chargeDate: string | null; // normalized YYYY-MM-DD, when the card bill actually hit the bank
}

export function newTransaction(partial: Omit<Transaction, "needsReview" | "doneBy" | "hint" | "category" | "chargeDate"> & Partial<Pick<Transaction, "category" | "hint" | "chargeDate">>): Transaction {
  return {
    category: null,
    needsReview: false,
    doneBy: null,
    hint: null,
    chargeDate: null,
    ...partial,
  };
}

/** True if value matches a D/M/Y-style date (any of / or - as separator, 2
 * or 4 digit year). Used to tell real data rows apart from headers, blank
 * rows, and trailing notes in a raw export — those never have a valid date
 * in the date column, so this doubles as a row filter. */
export function looksLikeDate(value: string | undefined): boolean {
  return DATE_RE.test((value ?? "").trim());
}

/** Accepts D/M/YY, DD/MM/YYYY, DD-MM-YYYY etc. and returns YYYY-MM-DD. */
export function normalizeDate(value: string): string {
  value = value.trim();
  const sep = value.includes("/") ? "/" : "-";
  const parts = value.split(sep);
  if (parts.length !== 3) return value;
  const [day, month] = parts;
  let year = parts[2];
  if (year.length === 2) year = "20" + year;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Turns a raw amount cell ("₪ 1,234.56", "-$45.00", "1234", ...) into a
 * number. Strips thousands separators and currency symbols, keeps the sign.
 * Does not do currency conversion — that's a separate step (see fx-rates.ts)
 * for sources that can bill in a foreign currency. */
export function parseAmount(raw: string | null | undefined): number {
  if (raw == null) return 0;
  let s = String(raw).trim();
  if (!s) return 0;
  s = s.replaceAll(",", "").replaceAll("₪", "").replaceAll("$", "").replaceAll("€", "").trim();
  const negative = s.startsWith("-");
  s = s.replace(/^-/, "").trim();
  if (!s) return 0;
  const val = parseFloat(s);
  return negative ? -val : val;
}

/** Parses raw CSV text into logical rows (csv-parse correctly merges
 * multi-line quoted cells, which Cal's export uses in its header). Strips a
 * leading UTF-8 BOM if present, matching Python's utf-8-sig handling. */
export function readLogicalRows(content: string): string[][] {
  const withoutBom = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  return parseCsv(withoutBom, {
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
}
