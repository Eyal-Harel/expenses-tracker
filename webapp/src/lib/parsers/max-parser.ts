import { normalizeCategory } from "../categories";
import { isHealthClinic, looksLikeDate, newTransaction, normalizeDate, parseAmount, readLogicalRows, type Transaction } from "./common";

// Merchants whose category depends on the transaction amount, not just the
// merchant name (confirmed against real data: both AM:PM branches follow the
// threshold, not just Bograshov as first described).
const THRESHOLD_MERCHANTS = new Set(["סופר פארם גורדון", "אי.אם.פי.אם גורדון", "אי.אם.פי.אם בוגרשוב"]);
const THRESHOLD_AMOUNT = 20;
const ABOVE_THRESHOLD_CATEGORY = "Groceries + Daily Produce";
const BELOW_THRESHOLD_CATEGORY = "Recreations & Wolt";

// The user's real Groceries + Daily Produce merchants are a closed, known
// list (they always shop at the same handful of places). Anything else Max
// tags with its generic "מזון וצריכה" (food & consumption) category — which
// covers everything from supermarkets to bakeries/snack bars — is treated as
// Recreation instead. Tradeoff: a genuinely new grocery store would need to
// be added here explicitly, or it'll default to Recreation.
const KNOWN_GROCERY_MERCHANTS = new Set(["טיב טעם  רשתות בן יהודה 0", "שופרסל שלי בן יהודה"]);
const MAX_RESTAURANT_HINT = "מסעדות";
const MAX_GENERIC_FOOD_HINT = "מזון וצריכה";

// Max's own category covers fuel, electricity and gas together, but the
// user's real usage under this label is gas stations -> Transportation.
// Caveat: if a genuine electricity/gas utility bill ever shows up tagged the
// same way, it would also get mapped to Transportation.
const MAX_FUEL_HINT = "דלק, חשמל וגז";

// Abroad-tab merchant overrides: Max sometimes charges these on the abroad
// tab instead of local (unclear why), but they're not travel spending.
// Matched case-insensitively since capitalization isn't consistent.
const ABROAD_MERCHANT_OVERRIDES: [string, string][] = [
  ["aliexpress", "Clothing + Ali Express"],
  ["spotify", "Subscriptions"],
  ["netflix", "Subscriptions"],
  ["lime", "Transportation"], // e.g. "LIME*RIDE..." — a scooter/bike-share ride, not travel
];

// Column layout confirmed from the real "... עסקאות במועד החיוב.csv" (local) export:
// [Date, Merchant, MaxOwnCategory, Last4, TxnType, ChargeAmount, ChargeCurrency,
//  OriginalAmount, OriginalCurrency, ChargeDate, (Category)]
const LOCAL_COL_DATE = 0;
const LOCAL_COL_MERCHANT = 1;
const LOCAL_COL_MAX_CATEGORY = 2;
const LOCAL_COL_CHARGE_AMOUNT = 5;
const LOCAL_COL_CHARGE_DATE = 9;
const LOCAL_COL_CATEGORY = 10;

// Column layout confirmed from the real "... עסקאות חו_ל ומט_ח.csv" (abroad) export:
// same first 10 columns as local, then notes/tags/discount/payment-method/exchange-rate.
// No Category column — every row here is Tier 0, defaulting to Travel except
// the merchant overrides above (AliExpress/Spotify/Netflix sometimes land here too).
const ABROAD_COL_DATE = 0;
const ABROAD_COL_MERCHANT = 1;
const ABROAD_COL_CHARGE_AMOUNT = 5;
const ABROAD_COL_CHARGE_DATE = 9;

/** Hard-coded Max-local rules: health clinics, and the amount-threshold
 * split for AM:PM/Super-Pharm branches. Returns null (falls through to
 * Tier 1 / Tier 1.5 / Tier 2) for everything else. */
export function tier0LocalCategory(merchant: string, amount: number): string | null {
  if (isHealthClinic(merchant)) return "Health";
  if (THRESHOLD_MERCHANTS.has(merchant)) {
    return amount > THRESHOLD_AMOUNT ? ABOVE_THRESHOLD_CATEGORY : BELOW_THRESHOLD_CATEGORY;
  }
  return null;
}

/** Runs after the merchant rules table has had a chance to resolve the
 * transaction, before falling back to the LLM. Uses Max's own (unreliable)
 * category label as a heuristic: known groceries always win; anything else
 * Max tags as generic 'food & consumption' is treated as Recreation, since
 * that bucket covers everything from supermarkets to bakeries/snack bars. */
export function resolveHint(merchant: string, maxOwnCategory: string): string | null {
  if (KNOWN_GROCERY_MERCHANTS.has(merchant)) return ABOVE_THRESHOLD_CATEGORY;
  if (maxOwnCategory.includes(MAX_RESTAURANT_HINT) || maxOwnCategory === MAX_GENERIC_FOOD_HINT) {
    return BELOW_THRESHOLD_CATEGORY;
  }
  if (maxOwnCategory === MAX_FUEL_HINT) return "Transportation";
  return null;
}

/** Every abroad-tab row gets a category unconditionally (unlike local,
 * there's no 'fall through to Tier 1' here): health clinics, the named
 * merchant overrides (AliExpress/Spotify/Netflix/Lime), or Travel by
 * default for everything else. */
export function tier0AbroadCategory(merchant: string): string {
  if (isHealthClinic(merchant)) return "Health";
  const merchantLower = merchant.toLowerCase();
  for (const [pattern, category] of ABROAD_MERCHANT_OVERRIDES) {
    if (merchantLower.includes(pattern)) return category;
  }
  return "Travel";
}

function chargeDateOrNull(field: string): string | null {
  return looksLikeDate(field) ? normalizeDate(field) : null;
}

/** Reads a Max local-deals export CSV end to end: every data row becomes a
 * Transaction, carrying both Max's own charge date (per-row, but usually the
 * same single date for every row in the file) and its own category hint,
 * for Tier 1.5 to use later if Tier 0/1 don't resolve it. */
export function parseLocal(content: string): Transaction[] {
  const rows = readLogicalRows(content);
  const transactions: Transaction[] = [];

  for (const row of rows) {
    if (row.length <= LOCAL_COL_CHARGE_AMOUNT) continue;
    const dateField = (row[LOCAL_COL_DATE] ?? "").trim();
    if (!looksLikeDate(dateField)) continue; // period marker / header / blank / trailing "Important notes" rows

    const merchant = (row[LOCAL_COL_MERCHANT] ?? "").trim();
    const amount = parseAmount(row[LOCAL_COL_CHARGE_AMOUNT]);
    const maxOwnCategory = row.length > LOCAL_COL_MAX_CATEGORY ? (row[LOCAL_COL_MAX_CATEGORY] ?? "").trim() : "";
    const chargeDateField = row.length > LOCAL_COL_CHARGE_DATE ? (row[LOCAL_COL_CHARGE_DATE] ?? "").trim() : "";

    transactions.push(
      newTransaction({
        date: normalizeDate(dateField),
        source: "Max",
        merchant,
        amount,
        category: tier0LocalCategory(merchant, amount),
        hint: maxOwnCategory,
        chargeDate: chargeDateOrNull(chargeDateField),
      }),
    );
  }
  return transactions;
}

/** Reads a Max abroad-deals export CSV end to end: every data row becomes a
 * Transaction. Unlike local, each row here carries its own individual
 * charge date (foreign transactions settle on a rolling basis, not bundled
 * into one statement date) and is fully categorized by Tier 0 already. */
export function parseAbroad(content: string): Transaction[] {
  const rows = readLogicalRows(content);
  const transactions: Transaction[] = [];

  for (const row of rows) {
    if (row.length <= ABROAD_COL_CHARGE_AMOUNT) continue;
    const dateField = (row[ABROAD_COL_DATE] ?? "").trim();
    if (!looksLikeDate(dateField)) continue; // metadata / period marker / header / trailing total rows

    const merchant = (row[ABROAD_COL_MERCHANT] ?? "").trim();
    const amount = parseAmount(row[ABROAD_COL_CHARGE_AMOUNT]);
    const chargeDateField = row.length > ABROAD_COL_CHARGE_DATE ? (row[ABROAD_COL_CHARGE_DATE] ?? "").trim() : "";

    transactions.push(
      newTransaction({
        date: normalizeDate(dateField),
        source: "Max",
        merchant,
        amount,
        category: tier0AbroadCategory(merchant),
        chargeDate: chargeDateOrNull(chargeDateField),
      }),
    );
  }
  return transactions;
}

/** Yields [merchant, category] pairs from an already-categorized local-deals
 * example export, for building the initial Category Rules seed. Skips
 * threshold merchants since those must stay a hard-coded Tier 0 rule. */
export function* iterSeedPairs(content: string): Generator<[string, string]> {
  const rows = readLogicalRows(content);
  for (const row of rows) {
    if (row.length <= LOCAL_COL_CATEGORY) continue;
    const dateField = (row[LOCAL_COL_DATE] ?? "").trim();
    if (!looksLikeDate(dateField)) continue;
    const merchant = (row[LOCAL_COL_MERCHANT] ?? "").trim();
    if (THRESHOLD_MERCHANTS.has(merchant)) continue;
    const category = normalizeCategory(row[LOCAL_COL_CATEGORY]);
    if (merchant && category) yield [merchant, category];
  }
}
