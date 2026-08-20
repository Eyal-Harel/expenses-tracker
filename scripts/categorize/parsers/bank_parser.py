from .common import Transaction, is_health_clinic, looks_like_date, normalize_date, parse_amount, read_logical_rows

# Substring match, not exact: confirmed across real exports that the bank
# reorders both columns AND the words within a description between exports
# (e.g. "5237 - כרטיסי אשראי לי" vs "כרטיסי אשראי לי - 5237"), so match on
# the stable core phrase rather than the exact string.
IGNORE_DESCRIPTIONS = [
    "מקס איט פיננסים",
    "כרטיסי אשראי לי",
]

# Tier 0: description -> fixed category. Checked as substring, case-sensitive
# (Hebrew has no case), in order; first match wins.
PATTERN_RULES = [
    ("העברת שכר דירה", "Rent"),
    ("עמלה", "Bank Fees"),
    ("עמלת", "Bank Fees"),
    ("זיכוי", "Other Credits"),
    ("משכורת", "Salary"),
    ("מילואים", "Reserved Duty"),
    ('דנ"ח ניע תקופתי', "Bank Fees"),
    # Fund-transfer standing orders and forex-purchase fees: money moving
    # between the user's own accounts / minor bank noise, not real spend or
    # income. Reference numbers vary per transaction, so match by substring.
    ("נע-קניה", "Irrelevant"),
    ("נע-מכירה", "Irrelevant"),
    ("רכישת מטח", "Irrelevant"),
]

# Column order is NOT stable across exports (confirmed: the June export has
# these columns in a different order than July's), so columns are located by
# header name each time rather than by fixed position.
HEADER_DATE = "תאריך"
HEADER_DESCRIPTION = "תיאור"
HEADER_CREDIT = "זכות"
HEADER_DEBIT = "חובה"


def tier0_category(description: str) -> str | None:
    if is_health_clinic(description):
        return "Health"
    for pattern, category in PATTERN_RULES:
        if pattern in description:
            return category
    return None


def is_ignored(description: str) -> bool:
    return any(pattern in description for pattern in IGNORE_DESCRIPTIONS)


def find_columns(rows: list[list[str]]) -> tuple[int, dict[str, int]]:
    """Locates the header row and returns (row_index, {field: column_index})."""
    for i, row in enumerate(rows):
        cells = [c.strip() for c in row]
        if HEADER_DATE in cells and HEADER_DESCRIPTION in cells:
            return i, {
                "date": cells.index(HEADER_DATE),
                "description": cells.index(HEADER_DESCRIPTION),
                "credit": cells.index(HEADER_CREDIT),
                "debit": cells.index(HEADER_DEBIT),
            }
    raise ValueError("Could not find the Bank export's header row (expected columns תאריך/תיאור/זכות/חובה)")


def parse(path: str) -> list[Transaction]:
    rows = read_logical_rows(path)
    header_row_index, cols = find_columns(rows)
    transactions = []
    for row in rows[header_row_index + 1 :]:
        if len(row) <= max(cols.values()):
            continue
        date_field = row[cols["date"]].strip()
        if not looks_like_date(date_field):
            continue  # blank / trailing rows

        description = row[cols["description"]].strip()
        if is_ignored(description):
            continue  # card-bill payment, already covered by Max/Cal imports

        credit = parse_amount(row[cols["credit"]])
        debit = parse_amount(row[cols["debit"]])
        amount = credit if credit else -debit

        transactions.append(
            Transaction(
                date=normalize_date(date_field),
                source="Bank",
                merchant=description,
                amount=amount,
                category=tier0_category(description),
            )
        )
    return transactions
