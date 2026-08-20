export const CANONICAL_CATEGORIES = [
  // Credits
  "Salary",
  "Other Credits",
  "Reserved Duty",
  // Fixed Expenses
  "Rent",
  "Bills",
  // Running Expenses
  "Subscriptions",
  "Transportation",
  "Groceries + Daily Produce",
  "Psychologist",
  "Clothing + Ali Express",
  "Recreations & Wolt",
  "Friends weddings",
  "Aesthetics",
  "Health",
  "Paybox / Bit",
  "Bank Fees",
  "Others",
  // Irregular Expenses
  "Travel",
  "Furniture",
  "Others Irregulars",
  // Not part of the Credits/Fixed/Running/Irregular rollup taxonomy above —
  // money moving between the user's own accounts (fund transfers) or minor
  // bank noise that isn't real spending/income. Exclude rows with this
  // category from all Monthly Rollup sums.
  "Irrelevant",
] as const;

const LOOKUP = new Map(CANONICAL_CATEGORIES.map((c) => [c.toLowerCase(), c]));

// Merchants where the name alone can never tell you what was actually bought
// (e.g. a coupon/deal site — same merchant for a gym membership, a pizza
// discount, show tickets...). Always left for manual categorization: no
// rules table entry, no LLM guess, since both would silently be wrong as
// often as right with no signal to catch it.
export const ALWAYS_MANUAL_MERCHANTS = new Set(["בהצדעה"]);

/** Maps a possibly-differently-cased category string to its canonical
 * spelling. Returns null if raw is empty or doesn't match any known category. */
export function normalizeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return LOOKUP.get(raw.trim().toLowerCase()) ?? null;
}
