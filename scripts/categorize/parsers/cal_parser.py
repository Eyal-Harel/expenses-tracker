import re

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
USD_MARKER = "$"
USD_TO_ILS_RATE = 2.97  # approximate fixed rate, per user; not exact to the transaction day


def find_charge_date(rows: list[list[str]]) -> str | None:
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
    if is_health_clinic(merchant):
        return "Health"
    if PASSPORT_CARD_MARKER in merchant:
        return "Travel"
    if merchant == APPLE_MERCHANT and STANDING_ORDER_MARKER in txn_type:
        return "Subscriptions"
    return None


def parse(path: str) -> list[Transaction]:
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
        is_usd = USD_MARKER in raw_amount
        amount = parse_amount(raw_amount)
        if is_usd:
            amount *= USD_TO_ILS_RATE
        txn_type = row[COL_TYPE].strip() if len(row) > COL_TYPE else ""
        normalized_date = normalize_date(date_field)
        row_charge_date = normalized_date if is_usd else charge_date

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
