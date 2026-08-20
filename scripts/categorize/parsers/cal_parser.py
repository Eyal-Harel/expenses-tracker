import re

from .. import fx_rates
from ..categories import normalize_category
from .common import Transaction, is_health_clinic, looks_like_date, normalize_date, parse_amount, read_logical_rows

PASSPORT_CARD_MARKER = "פספורטכארד"

# The file's title line states the charge date once for the whole file, e.g.
# "עסקאות לחיוב ב-10/06/2026: 3,484.72 ₪". Applied to every ILS row in the file.
# USD-denominated rows (see USD_MARKER below) are excluded from that bundle —
# confirmed against real data: a "עסקאות שחויבו בדולר" / "immediate charge"
# sub-section with no stated date, charged separately from the main monthly
# cycle. For those, the transaction's own date is a much closer proxy than
# the main bundle's charge date (which was off by exactly the USD rows' sum
# when misapplied). Section-header phrasing varies between exports ("עסקאות
# שוטף בחו"ל" vs "עסקאות שחויבו בדולר"), so detect via the $ sign on the
# amount itself rather than the inconsistent Hebrew header text.
CHARGE_DATE_TITLE_RE = re.compile(r"לחיוב ב-(\d{1,2}/\d{1,2}/\d{4})")

# Any of these symbols in the amount cell means "not ILS, needs conversion"
# (see fx_rates.py). Only USD has actually shown up in real data so far —
# EUR/GBP are here so a future export in either doesn't silently repeat the
# exact bug we found and fixed for USD (amount stored as if it were ILS).
FOREIGN_CURRENCY_MARKERS = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
}


def detect_foreign_currency(raw_amount: str) -> str | None:
    """Returns the ISO code for the foreign currency this cell is
    denominated in (e.g. "USD"), or None if it's a plain ILS amount."""
    for symbol, code in FOREIGN_CURRENCY_MARKERS.items():
        if symbol in raw_amount:
            return code
    return None


def find_charge_date(rows: list[list[str]]) -> str | None:
    """Scans every cell in the file for the title-line charge-date pattern
    (see CHARGE_DATE_TITLE_RE above) and returns the first match, or None if
    the file doesn't have one (e.g. the very first Cal export we ever got
    didn't include this line at all)."""
    for row in rows:
        for cell in row:
            match = CHARGE_DATE_TITLE_RE.search(cell)
            if match:
                return normalize_date(match.group(1))
    return None

# APPLE.COM/BILL is not a single category: a standing order (הוראת קבע) is
# the recurring iCloud charge (Subscriptions); a one-off purchase (רגילה) is
# an App Store purchase (Others Irregulars, left to Tier 1/2 like any other
# merchant). Confirmed against real data: same merchant, different TxnType.
APPLE_MERCHANT = "APPLE.COM/BILL"
STANDING_ORDER_MARKER = "הוראת קבע"

# Column layout confirmed from the real "Cal Card - ....csv" export:
# [Date, Merchant, TxnAmount, ChargeAmount, TxnType, Branch, Notes, (Category)]
# The Category column only exists in the user's manually-annotated example
# file, used as rules-table seed data — real monthly downloads won't have it.
COL_DATE = 0
COL_MERCHANT = 1
COL_CHARGE_AMOUNT = 3
COL_TYPE = 4
COL_CATEGORY = 7


def tier0_category(merchant: str, txn_type: str) -> str | None:
    """Hard-coded Cal rules: health clinics, Passport Card -> Travel, and the
    standing-order-only Apple.com/Bill -> Subscriptions split. Returns None
    (falls through to Tier 1 / Tier 2 in main.py) for everything else."""
    if is_health_clinic(merchant):
        return "Health"
    if PASSPORT_CARD_MARKER in merchant:
        return "Travel"
    if merchant == APPLE_MERCHANT and STANDING_ORDER_MARKER in txn_type:
        return "Subscriptions"
    return None


def parse(path: str) -> list[Transaction]:
    """Reads a Cal export CSV end to end: every data row becomes a
    Transaction, with the file-wide charge date applied (except foreign-
    currency rows, which get their own transaction date and a live FX
    conversion to ILS instead — see detect_foreign_currency above) and
    Tier 0 categorization already applied where a rule matched."""
    rows = read_logical_rows(path)
    charge_date = find_charge_date(rows)
    transactions = []
    for row in rows:
        if len(row) <= COL_CHARGE_AMOUNT:
            continue
        date_field = row[COL_DATE].strip()
        if not looks_like_date(date_field):
            continue  # header / blank / trailing rows

        merchant = row[COL_MERCHANT].strip()
        raw_amount = row[COL_CHARGE_AMOUNT]
        foreign_currency = detect_foreign_currency(raw_amount)
        amount = parse_amount(raw_amount)
        normalized_date = normalize_date(date_field)
        if foreign_currency:
            amount *= fx_rates.get_rate(normalized_date, foreign_currency)
        txn_type = row[COL_TYPE].strip() if len(row) > COL_TYPE else ""
        row_charge_date = normalized_date if foreign_currency else charge_date

        transactions.append(
            Transaction(
                date=normalized_date,
                source="Cal",
                merchant=merchant,
                amount=amount,
                category=tier0_category(merchant, txn_type),
                charge_date=row_charge_date,
            )
        )
    return transactions


def iter_seed_pairs(path: str):
    """Yields (merchant, category) pairs from an already-categorized example
    export, for building the initial Category Rules seed. Skips merchants
    whose category is Tier-0-determined (Passport Card -> Travel) since that
    must stay a hard-coded rule, not a flat merchant lookup."""
    rows = read_logical_rows(path)
    for row in rows:
        if len(row) <= COL_CATEGORY:
            continue
        date_field = row[COL_DATE].strip()
        if not looks_like_date(date_field):
            continue
        merchant = row[COL_MERCHANT].strip()
        txn_type = row[COL_TYPE].strip() if len(row) > COL_TYPE else ""
        if tier0_category(merchant, txn_type) is not None:
            continue
        category = normalize_category(row[COL_CATEGORY])
        if merchant and category:
            yield merchant, category
