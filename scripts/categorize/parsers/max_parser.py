from ..categories import normalize_category
from .common import Transaction, is_health_clinic, looks_like_date, normalize_date, parse_amount, read_logical_rows

# Merchants whose category depends on the transaction amount, not just the
# merchant name (confirmed against real data: both AM:PM branches follow the
# threshold, not just Bograshov as first described).
THRESHOLD_MERCHANTS = {
    "סופר פארם גורדון",
    "אי.אם.פי.אם גורדון",
    "אי.אם.פי.אם בוגרשוב",
}
THRESHOLD_AMOUNT = 20
ABOVE_THRESHOLD_CATEGORY = "Groceries + Daily Produce"
BELOW_THRESHOLD_CATEGORY = "Recreations & Wolt"

# The user's real Groceries + Daily Produce merchants are a closed, known
# list (they always shop at the same handful of places). Anything else Max
# tags with its generic "מזון וצריכה" (food & consumption) category — which
# covers everything from supermarkets to bakeries/snack bars — is treated as
# Recreation instead. Tradeoff: a genuinely new grocery store would need to
# be added here explicitly, or it'll default to Recreation.
KNOWN_GROCERY_MERCHANTS = {
    "טיב טעם  רשתות בן יהודה 0",
    "שופרסל שלי בן יהודה",
}
MAX_RESTAURANT_HINT = "מסעדות"
MAX_GENERIC_FOOD_HINT = "מזון וצריכה"

# Max's own category covers fuel, electricity and gas together, but the
# user's real usage under this label is gas stations -> Transportation.
# Caveat: if a genuine electricity/gas utility bill ever shows up tagged the
# same way, it would also get mapped to Transportation.
MAX_FUEL_HINT = "דלק, חשמל וגז"

# Abroad-tab merchant overrides: Max sometimes charges these on the abroad
# tab instead of local (unclear why), but they're not travel spending.
# Matched case-insensitively since capitalization isn't consistent.
ABROAD_MERCHANT_OVERRIDES = [
    ("aliexpress", "Clothing + Ali Express"),
    ("spotify", "Subscriptions"),
    ("netflix", "Subscriptions"),
    ("lime", "Transportation"),  # e.g. "LIME*RIDE..." — a scooter/bike-share ride, not travel
]

# Column layout confirmed from the real "... עסקאות במועד החיוב.csv" (local) export:
# [Date, Merchant, MaxOwnCategory, Last4, TxnType, ChargeAmount, ChargeCurrency,
#  OriginalAmount, OriginalCurrency, ChargeDate, (Category)]
LOCAL_COL_DATE = 0
LOCAL_COL_MERCHANT = 1
LOCAL_COL_MAX_CATEGORY = 2
LOCAL_COL_CHARGE_AMOUNT = 5
LOCAL_COL_CHARGE_DATE = 9
LOCAL_COL_CATEGORY = 10

# Column layout confirmed from the real "... עסקאות חו_ל ומט_ח.csv" (abroad) export:
# same first 10 columns as local, then notes/tags/discount/payment-method/exchange-rate.
# No Category column — every row here is Tier 0, defaulting to Travel except
# the merchant overrides above (AliExpress/Spotify/Netflix sometimes land here too).
ABROAD_COL_DATE = 0
ABROAD_COL_MERCHANT = 1
ABROAD_COL_CHARGE_AMOUNT = 5
ABROAD_COL_CHARGE_DATE = 9


def tier0_local_category(merchant: str, amount: float) -> str | None:
    """Hard-coded Max-local rules: health clinics, and the amount-threshold
    split for AM:PM/Super-Pharm branches. Returns None (falls through to
    Tier 1 / Tier 1.5 / Tier 2 in main.py) for everything else."""
    if is_health_clinic(merchant):
        return "Health"
    if merchant in THRESHOLD_MERCHANTS:
        return ABOVE_THRESHOLD_CATEGORY if amount > THRESHOLD_AMOUNT else BELOW_THRESHOLD_CATEGORY
    return None


def resolve_hint(merchant: str, max_own_category: str) -> str | None:
    """Runs after the merchant rules table has had a chance to resolve the
    transaction, before falling back to the LLM. Uses Max's own (unreliable)
    category label as a heuristic: known groceries always win; anything else
    Max tags as generic 'food & consumption' is treated as Recreation, since
    that bucket covers everything from supermarkets to bakeries/snack bars."""
    if merchant in KNOWN_GROCERY_MERCHANTS:
        return ABOVE_THRESHOLD_CATEGORY
    if MAX_RESTAURANT_HINT in max_own_category or max_own_category == MAX_GENERIC_FOOD_HINT:
        return BELOW_THRESHOLD_CATEGORY
    if max_own_category == MAX_FUEL_HINT:
        return "Transportation"
    return None


def tier0_abroad_category(merchant: str) -> str:
    """Every abroad-tab row gets a category unconditionally (unlike local,
    there's no 'fall through to Tier 1' here): health clinics, the named
    merchant overrides (AliExpress/Spotify/Netflix/Lime), or Travel by
    default for everything else."""
    if is_health_clinic(merchant):
        return "Health"
    merchant_lower = merchant.lower()
    for pattern, category in ABROAD_MERCHANT_OVERRIDES:
        if pattern in merchant_lower:
            return category
    return "Travel"


def parse_local(path: str) -> list[Transaction]:
    """Reads a Max local-deals export CSV end to end: every data row becomes
    a Transaction, carrying both Max's own charge date (per-row, but usually
    the same single date for every row in the file) and its own category
    hint, for Tier 1.5 to use later if Tier 0/1 don't resolve it."""
    rows = read_logical_rows(path)
    transactions = []
    for row in rows:
        if len(row) <= LOCAL_COL_CHARGE_AMOUNT:
            continue
        date_field = row[LOCAL_COL_DATE].strip()
        if not looks_like_date(date_field):
            continue  # period marker / header / blank / trailing "Important notes" rows

        merchant = row[LOCAL_COL_MERCHANT].strip()
        amount = parse_amount(row[LOCAL_COL_CHARGE_AMOUNT])
        max_own_category = row[LOCAL_COL_MAX_CATEGORY].strip() if len(row) > LOCAL_COL_MAX_CATEGORY else ""
        charge_date_field = row[LOCAL_COL_CHARGE_DATE].strip() if len(row) > LOCAL_COL_CHARGE_DATE else ""

        transactions.append(
            Transaction(
                date=normalize_date(date_field),
                source="Max",
                merchant=merchant,
                amount=amount,
                category=tier0_local_category(merchant, amount),
                hint=max_own_category,
                charge_date=normalize_date(charge_date_field) if looks_like_date(charge_date_field) else None,
            )
        )
    return transactions


def parse_abroad(path: str) -> list[Transaction]:
    """Reads a Max abroad-deals export CSV end to end: every data row becomes
    a Transaction. Unlike local, each row here carries its own individual
    charge date (foreign transactions settle on a rolling basis, not bundled
    into one statement date) and is fully categorized by Tier 0 already."""
    rows = read_logical_rows(path)
    transactions = []
    for row in rows:
        if len(row) <= ABROAD_COL_CHARGE_AMOUNT:
            continue
        date_field = row[ABROAD_COL_DATE].strip()
        if not looks_like_date(date_field):
            continue  # metadata / period marker / header / trailing total rows

        merchant = row[ABROAD_COL_MERCHANT].strip()
        amount = parse_amount(row[ABROAD_COL_CHARGE_AMOUNT])
        charge_date_field = row[ABROAD_COL_CHARGE_DATE].strip() if len(row) > ABROAD_COL_CHARGE_DATE else ""

        transactions.append(
            Transaction(
                date=normalize_date(date_field),
                source="Max",
                merchant=merchant,
                amount=amount,
                category=tier0_abroad_category(merchant),
                charge_date=normalize_date(charge_date_field) if looks_like_date(charge_date_field) else None,
            )
        )
    return transactions


def iter_seed_pairs(path: str):
    """Yields (merchant, category) pairs from an already-categorized local-deals
    example export, for building the initial Category Rules seed. Skips
    threshold merchants since those must stay a hard-coded Tier 0 rule."""
    rows = read_logical_rows(path)
    for row in rows:
        if len(row) <= LOCAL_COL_CATEGORY:
            continue
        date_field = row[LOCAL_COL_DATE].strip()
        if not looks_like_date(date_field):
            continue
        merchant = row[LOCAL_COL_MERCHANT].strip()
        if merchant in THRESHOLD_MERCHANTS:
            continue
        category = normalize_category(row[LOCAL_COL_CATEGORY])
        if merchant and category:
            yield merchant, category
