from ..categories import normalize_category
from .common import Transaction, is_health_clinic, looks_like_date, normalize_date, parse_amount, read_logical_rows

PASSPORT_CARD_MARKER = "פספורטכארד"

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
    transactions = []
    for row in rows:
        if len(row) <= COL_CHARGE_AMOUNT:
            continue
        date_field = row[COL_DATE].strip()
        if not looks_like_date(date_field):
            continue  # header / blank / trailing rows

        merchant = row[COL_MERCHANT].strip()
        amount = parse_amount(row[COL_CHARGE_AMOUNT])
        txn_type = row[COL_TYPE].strip() if len(row) > COL_TYPE else ""

        transactions.append(
            Transaction(
                date=normalize_date(date_field),
                source="Cal",
                merchant=merchant,
                amount=amount,
                category=tier0_category(merchant, txn_type),
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
