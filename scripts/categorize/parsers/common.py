import csv
import re
from collections.abc import Callable
from dataclasses import dataclass, field

DATE_RE = re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$")

# Shared across sources: a merchant name containing one of these is a medical
# clinic, regardless of which specific clinic — catches new ones on first
# sight instead of needing the LLM (and then a rules-table entry) every time.
HEALTH_CLINIC_MARKERS = ("מרפאת", "מרפאה")


def is_health_clinic(merchant: str) -> bool:
    """True if the merchant name contains a clinic marker (see HEALTH_CLINIC_MARKERS above)."""
    return any(marker in merchant for marker in HEALTH_CLINIC_MARKERS)


@dataclass
class Transaction:
    """The one common shape every source parser (bank/cal/max) produces,
    regardless of how different each raw export's format is. Everything
    downstream of parsing — categorization, writing to the sheet — only
    ever deals with this shape, never the source-specific raw rows."""
    date: str  # normalized YYYY-MM-DD, deal/transaction date (when the purchase happened)
    source: str  # "Max" | "Cal" | "Bank"
    merchant: str  # merchant name, or description for Bank rows
    amount: float
    category: str | None = None
    needs_review: bool = False
    done_by: str | None = None  # "Script" | "AI"
    hint: str | None = None  # source's own category label, e.g. Max's "קטגוריה" column; used by the pipeline, not written to the sheet
    charge_date: str | None = None  # normalized YYYY-MM-DD, when the card bill actually hit the bank


def looks_like_date(value: str) -> bool:
    """True if value matches a D/M/Y-style date (any of / or - as separator,
    2 or 4 digit year). Used to tell real data rows apart from headers,
    blank rows, and trailing notes in a raw export — those never have a
    valid date in the date column, so this doubles as a row filter."""
    return bool(DATE_RE.match((value or "").strip()))


def normalize_date(value: str, day_first: bool = True) -> str:
    """Accepts D/M/YY, DD/MM/YYYY, DD-MM-YYYY etc. and returns YYYY-MM-DD."""
    value = value.strip()
    sep = "/" if "/" in value else "-"
    parts = value.split(sep)
    if len(parts) != 3:
        return value
    day, month, year = parts
    if len(year) == 2:
        year = "20" + year
    return f"{year}-{int(month):02d}-{int(day):02d}"


def parse_amount(raw: str) -> float:
    """Turns a raw amount cell ("₪ 1,234.56", "-$45.00", "1234", ...) into a
    float. Strips thousands separators and currency symbols, keeps the sign.
    Does not do currency conversion — that's a separate step (see fx_rates.py)
    for sources that can bill in a foreign currency."""
    if raw is None:
        return 0.0
    s = str(raw).strip()
    if not s:
        return 0.0
    s = s.replace(",", "").replace("₪", "").replace("$", "").replace("€", "").strip()
    negative = s.startswith("-")
    s = s.lstrip("-").strip()
    if not s:
        return 0.0
    val = float(s)
    return -val if negative else val


def _xlsx_cell_to_str(value: object) -> str:
    """Converts one openpyxl cell value to the same style of string a raw CSV
    export would contain. Dates are formatted D/M/Y (not ISO) because
    looks_like_date()/normalize_date() above only recognize that day-first
    style — a native Excel date cell formatted as ISO would silently fail
    looks_like_date() and get dropped as if it were a header/blank row."""
    import datetime

    if value is None:
        return ""
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.strftime("%d/%m/%Y")
    return str(value)


def _read_xlsx_rows(path: str, sheet_matcher: Callable[[str], bool] | None) -> list[list[str]]:
    import openpyxl

    workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
    worksheet = workbook.active
    if sheet_matcher is not None:
        for ws in workbook.worksheets:
            if sheet_matcher(ws.title):
                worksheet = ws
                break
    return [[_xlsx_cell_to_str(cell) for cell in row] for row in worksheet.iter_rows(values_only=True)]


def read_logical_rows(path: str, sheet_matcher: Callable[[str], bool] | None = None) -> list[list[str]]:
    """Reads a CSV or .xlsx file into logical rows (csv.reader correctly
    merges multi-line quoted cells, which Cal's export uses in its header).
    For a multi-sheet .xlsx (e.g. Max's real workbook, local + abroad tabs in
    one file), `sheet_matcher` picks which worksheet to read; without one, the
    workbook's active/only sheet is used."""
    if path.lower().endswith(".xlsx"):
        return _read_xlsx_rows(path, sheet_matcher)
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.reader(f))
