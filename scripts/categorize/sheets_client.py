import os

from .parsers.common import Transaction
from .rules_store import SheetsRulesStore

TRANSACTIONS_HEADER = ["Date", "Source", "Merchant", "Amount", "Category", "Needs Review", "Done by"]
RULES_HEADER = ["Merchant", "Category"]

TRANSACTIONS_TAB = "Transactions"
RULES_TAB = "Category Rules"


def get_client():
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    key_path = os.environ["GOOGLE_SERVICE_ACCOUNT_JSON_PATH"]
    creds = Credentials.from_service_account_file(key_path, scopes=scopes)
    return gspread.authorize(creds)


def open_spreadsheet(client, sheet_id: str):
    return client.open_by_key(sheet_id)


def _get_or_create_worksheet(spreadsheet, title: str, header: list[str]):
    import gspread

    try:
        ws = spreadsheet.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = spreadsheet.add_worksheet(title=title, rows=1000, cols=max(len(header), 1))

    if not ws.acell("A1").value:  # tab exists but has no header (e.g. just cleared)
        ws.append_row(header)
    return ws


def get_rules_store(spreadsheet) -> SheetsRulesStore:
    ws = _get_or_create_worksheet(spreadsheet, RULES_TAB, RULES_HEADER)
    return SheetsRulesStore(ws)


class TransactionsSheet:
    def __init__(self, spreadsheet):
        self.ws = _get_or_create_worksheet(spreadsheet, TRANSACTIONS_TAB, TRANSACTIONS_HEADER)

    def append(self, transactions: list[Transaction]) -> None:
        rows = [
            [t.date, t.source, t.merchant, t.amount, t.category, t.needs_review, t.done_by]
            for t in transactions
        ]
        if rows:
            self.ws.append_rows(rows, value_input_option="RAW")
