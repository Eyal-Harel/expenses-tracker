import csv
import re
from dataclasses import dataclass, field

DATE_RE = re.compile(r"^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$")

# Shared across sources: a merchant name containing one of these is a medical
# clinic, regardless of which specific clinic — catches new ones on first
# sight instead of needing the LLM (and then a rules-table entry) every time.
HEALTH_CLINIC_MARKERS = ("מרפאת", "מרפאה")


def is_health_clinic(merchant: str) -> bool:
    return any(marker in merchant for marker in HEALTH_CLINIC_MARKERS)


@dataclass
class Transaction:
    date: str  # normalized YYYY-MM-DD
    source: str  # "Max" | "Cal" | "Bank"
    merchant: str  # merchant name, or description for Bank rows
    amount: float
    category: str | None = None
    needs_review: bool = False
    done_by: str | None = None  # "Script" | "AI"
    hint: str | None = None  # source's own category label, e.g. Max's "קטגוריה" column; used by the pipeline, not written to the sheet


def looks_like_date(value: str) -> bool:
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


def read_logical_rows(path: str) -> list[list[str]]:
    """Reads a CSV file into logical rows (csv.reader correctly merges
    multi-line quoted cells, which Cal's export uses in its header)."""
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.reader(f))
