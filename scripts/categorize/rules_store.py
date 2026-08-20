import csv
from abc import ABC, abstractmethod
from pathlib import Path


class RulesStore(ABC):
    @abstractmethod
    def get(self, key: str) -> str | None: ...

    @abstractmethod
    def add(self, key: str, category: str) -> None: ...

    @abstractmethod
    def save(self) -> None: ...


class CsvRulesStore(RulesStore):
    """Local-file-backed rules table, e.g. for dry runs before Sheets auth is set up."""

    def __init__(self, path: str):
        self.path = Path(path)
        self._rules: dict[str, str] = {}
        if self.path.exists():
            with open(self.path, encoding="utf-8", newline="") as f:
                for row in csv.DictReader(f):
                    merchant = (row.get("Merchant") or "").strip()
                    category = (row.get("Category") or "").strip()
                    if merchant and category:
                        self._rules[merchant] = category

    def get(self, key: str) -> str | None:
        return self._rules.get(key.strip())

    def add(self, key: str, category: str) -> None:
        self._rules[key.strip()] = category

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["Merchant", "Category"])
            for merchant, category in sorted(self._rules.items()):
                writer.writerow([merchant, category])


class SheetsRulesStore(RulesStore):
    """Google Sheets-backed rules table (the 'Category Rules' tab)."""

    def __init__(self, worksheet):
        self.ws = worksheet
        self._rules: dict[str, str] = {}
        for record in self.ws.get_all_records():
            merchant = str(record.get("Merchant") or "").strip()
            category = str(record.get("Category") or "").strip()
            if merchant and category:
                self._rules[merchant] = category
        self._pending_rows: list[list[str]] = []

    def get(self, key: str) -> str | None:
        return self._rules.get(key.strip())

    def add(self, key: str, category: str) -> None:
        key = key.strip()
        self._rules[key] = category
        self._pending_rows.append([key, category])

    def save(self) -> None:
        if self._pending_rows:
            self.ws.append_rows(self._pending_rows, value_input_option="RAW")
            self._pending_rows = []
