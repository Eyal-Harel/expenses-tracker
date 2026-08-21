import { getRate } from "../fx-rates";
import { normalizeCategory } from "../categories";
import { isHealthClinic, looksLikeDate, newTransaction, normalizeDate, parseAmount, readLogicalRows, type Transaction } from "./common";

const PASSPORT_CARD_MARKER = "פספורטכארד";

// A title line states the charge date for every ILS row that follows it,
// e.g. "עסקאות לחיוב ב-10/06/2026: 3,484.72 ₪" — normally once per file, but
// a file can have more than one of these if several monthly exports were
// concatenated before uploading, so each row is matched against the most
// recent title line above it (see chargeDatesByRow), not just the file's
// first one. Foreign-currency rows (see FOREIGN_CURRENCY_MARKERS below) are
// excluded from that bundle — confirmed against real data: a "עסקאות שחויבו
// בדולר" / "immediate charge" sub-section with no stated date, charged
// separately from the main monthly cycle. For those, the transaction's own
// date is a much closer proxy than the main bundle's charge date (which was
// off by exactly the USD rows' sum when misapplied). Section-header phrasing
// varies between exports ("עסקאות שוטף בחו"ל" vs "עסקאות שחויבו בדולר"), so
// detect via the currency symbol on the amount itself rather than the
// inconsistent Hebrew header text.
const CHARGE_DATE_TITLE_RE = /לחיוב ב-(\d{1,2}\/\d{1,2}\/\d{4})/;

// Any of these symbols in the amount cell means "not ILS, needs conversion"
// (see fx-rates.ts). Only USD has actually shown up in real data so far —
// EUR/GBP are here so a future export in either doesn't silently repeat the
// exact bug we found and fixed for USD (amount stored as if it were ILS).
const FOREIGN_CURRENCY_MARKERS: [string, string][] = [
  ["$", "USD"],
  ["€", "EUR"],
  ["£", "GBP"],
];

/** Returns the ISO code for the foreign currency this cell is denominated
 * in (e.g. "USD"), or null if it's a plain ILS amount. */
export function detectForeignCurrency(rawAmount: string): string | null {
  for (const [symbol, code] of FOREIGN_CURRENCY_MARKERS) {
    if (rawAmount.includes(symbol)) return code;
  }
  return null;
}

/** Assigns each row the charge date from whichever title line most recently
 * preceded it, top to bottom. A single-statement export has one title line,
 * so every row gets the same date (the original behavior) — but a file
 * where several monthly exports have been concatenated (e.g. manually
 * combined before uploading) has one title line per section, and this
 * makes sure a row only ever picks up its OWN section's date, not
 * whichever title line happens to appear first in the file. Rows before
 * any title line (or in a file with no title line at all) get null. */
export function chargeDatesByRow(rows: string[][]): (string | null)[] {
  const dates: (string | null)[] = [];
  let current: string | null = null;
  for (const row of rows) {
    for (const cell of row) {
      const match = CHARGE_DATE_TITLE_RE.exec(cell);
      if (match) {
        current = normalizeDate(match[1]);
        break;
      }
    }
    dates.push(current);
  }
  return dates;
}

// APPLE.COM/BILL is not a single category: a standing order (הוראת קבע) is
// the recurring iCloud charge (Subscriptions); a one-off purchase (רגילה) is
// an App Store purchase (Others Irregulars, left to Tier 1/2 like any other
// merchant). Confirmed against real data: same merchant, different TxnType.
const APPLE_MERCHANT = "APPLE.COM/BILL";
const STANDING_ORDER_MARKER = "הוראת קבע";

// Column layout confirmed from the real "Cal Card - ....csv" export:
// [Date, Merchant, TxnAmount, ChargeAmount, TxnType, Branch, Notes, (Category)]
// The Category column only exists in the user's manually-annotated example
// file, used as rules-table seed data — real monthly downloads won't have it.
const COL_DATE = 0;
const COL_MERCHANT = 1;
const COL_CHARGE_AMOUNT = 3;
const COL_TYPE = 4;
const COL_CATEGORY = 7;

/** Hard-coded Cal rules: health clinics, Passport Card -> Travel, and the
 * standing-order-only Apple.com/Bill -> Subscriptions split. Returns null
 * (falls through to Tier 1 / Tier 2) for everything else. */
export function tier0Category(merchant: string, txnType: string): string | null {
  if (isHealthClinic(merchant)) return "Health";
  if (merchant.includes(PASSPORT_CARD_MARKER)) return "Travel";
  if (merchant === APPLE_MERCHANT && txnType.includes(STANDING_ORDER_MARKER)) return "Subscriptions";
  return null;
}

/** Reads a Cal export CSV end to end: every data row becomes a Transaction,
 * with its section's charge date applied (except foreign-currency rows,
 * which get their own transaction date and a live FX conversion to ILS
 * instead — see detectForeignCurrency above) and Tier 0 categorization
 * already applied where a rule matched. */
export async function parse(content: string): Promise<Transaction[]> {
  const rows = readLogicalRows(content);
  const chargeDates = chargeDatesByRow(rows);
  const transactions: Transaction[] = [];

  for (const [i, row] of rows.entries()) {
    if (row.length <= COL_CHARGE_AMOUNT) continue;
    const dateField = (row[COL_DATE] ?? "").trim();
    if (!looksLikeDate(dateField)) continue; // header / blank / trailing rows

    const merchant = (row[COL_MERCHANT] ?? "").trim();
    const rawAmount = row[COL_CHARGE_AMOUNT];
    const foreignCurrency = detectForeignCurrency(rawAmount);
    let amount = parseAmount(rawAmount);
    const normalizedDate = normalizeDate(dateField);
    if (foreignCurrency) {
      amount *= await getRate(normalizedDate, foreignCurrency);
    }
    const txnType = row.length > COL_TYPE ? (row[COL_TYPE] ?? "").trim() : "";
    const rowChargeDate = foreignCurrency ? normalizedDate : chargeDates[i];

    transactions.push(
      newTransaction({
        date: normalizedDate,
        source: "Cal",
        merchant,
        amount,
        category: tier0Category(merchant, txnType),
        chargeDate: rowChargeDate,
      }),
    );
  }
  return transactions;
}

/** Yields [merchant, category] pairs from an already-categorized example
 * export, for building the initial Category Rules seed. Skips merchants
 * whose category is Tier-0-determined (Passport Card -> Travel) since that
 * must stay a hard-coded rule, not a flat merchant lookup. */
export function* iterSeedPairs(content: string): Generator<[string, string]> {
  const rows = readLogicalRows(content);
  for (const row of rows) {
    if (row.length <= COL_CATEGORY) continue;
    const dateField = (row[COL_DATE] ?? "").trim();
    if (!looksLikeDate(dateField)) continue;
    const merchant = (row[COL_MERCHANT] ?? "").trim();
    const txnType = row.length > COL_TYPE ? (row[COL_TYPE] ?? "").trim() : "";
    if (tier0Category(merchant, txnType) !== null) continue;
    const category = normalizeCategory(row[COL_CATEGORY]);
    if (merchant && category) yield [merchant, category];
  }
}
