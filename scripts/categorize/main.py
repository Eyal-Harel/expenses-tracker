"""Monthly import: parse Bank / Cal / Max exports, categorize them through the
tiered pipeline (hard-coded rules -> rules table -> LLM fallback), and append
the results to the Transactions sheet (or a local CSV with --dry-run).

Usage:
    python -m categorize.main --bank <path> --cal <path> \
        --max-local <path> --max-abroad <path> [--dry-run] [--no-llm]
"""

import argparse
import csv
import os

from .categories import ALWAYS_MANUAL_MERCHANTS
from .llm_fallback import categorize_with_llm
from .parsers import bank_parser, cal_parser, max_parser
from .parsers.common import Transaction
from .rules_store import CsvRulesStore, RulesStore


def categorize(transactions: list[Transaction], rules: RulesStore, use_llm: bool) -> None:
    """Fills in .category, .done_by and .needs_review in place: always-manual
    merchants first -> Tier 0 (source parsers, already applied) -> Tier 1
    (rules table) -> Tier 1.5 (source-specific heuristics, e.g. Max's own
    category hint) -> Tier 2 (LLM fallback)."""
    for t in transactions:
        if t.merchant in ALWAYS_MANUAL_MERCHANTS:
            t.done_by = "Manual"
            t.needs_review = True
            continue  # never guessed, never memoized — name alone can't tell you what this was

        if t.category is not None:
            t.done_by = "Script"  # resolved by a source parser's Tier 0 rule
            continue

        rule_category = rules.get(t.merchant)
        if rule_category is not None:
            t.category = rule_category
            t.done_by = "Script"
            continue

        if t.source == "Max" and t.hint:
            hint_category = max_parser.resolve_hint(t.merchant, t.hint)
            if hint_category is not None:
                t.category = hint_category
                t.done_by = "Script"
                rules.add(t.merchant, t.category)  # memoize so future runs skip straight to Tier 1
                continue

        if use_llm:
            try:
                t.category = categorize_with_llm(t.merchant, t.amount, t.source)
                rules.add(t.merchant, t.category)
            except Exception as e:
                print(f"WARNING: LLM categorization failed for '{t.merchant}' ({e}); leaving uncategorized")
        t.done_by = "AI"
        t.needs_review = True


def write_dry_run_csv(path: str, transactions: list[Transaction]) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Date", "Source", "Merchant", "Amount", "Category", "Needs Review", "Done by"])
        for t in transactions:
            writer.writerow([t.date, t.source, t.merchant, t.amount, t.category, t.needs_review, t.done_by])


def main():
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bank", help="Path to a Bank Activities export CSV")
    parser.add_argument("--cal", help="Path to a Cal export CSV")
    parser.add_argument("--max-local", help="Path to a Max local-deals export CSV")
    parser.add_argument("--max-abroad", help="Path to a Max abroad-deals export CSV")
    parser.add_argument("--dry-run", action="store_true", help="Write to a local CSV instead of the Google Sheet")
    parser.add_argument("--no-llm", action="store_true", help="Skip LLM fallback; unresolved rows are just flagged Needs Review")
    parser.add_argument("--out", default="data/transactions_output.csv", help="Output path for --dry-run")
    parser.add_argument("--rules-csv", default="data/category_rules.csv", help="Local rules table path for --dry-run")
    args = parser.parse_args()

    transactions: list[Transaction] = []
    if args.bank:
        transactions += bank_parser.parse(args.bank)
    if args.cal:
        transactions += cal_parser.parse(args.cal)
    if args.max_local:
        transactions += max_parser.parse_local(args.max_local)
    if args.max_abroad:
        transactions += max_parser.parse_abroad(args.max_abroad)

    if not transactions:
        parser.error("No input files given (use at least one of --bank/--cal/--max-local/--max-abroad)")

    use_llm = not args.no_llm

    if args.dry_run:
        rules = CsvRulesStore(args.rules_csv)
        categorize(transactions, rules, use_llm)
        rules.save()
        write_dry_run_csv(args.out, transactions)
        print(f"Wrote {len(transactions)} transactions to {args.out} (dry run, rules table: {args.rules_csv})")
    else:
        from . import sheets_client

        client = sheets_client.get_client()
        spreadsheet = sheets_client.open_spreadsheet(client, os.environ["SHEET_ID"])
        rules = sheets_client.get_rules_store(spreadsheet)
        categorize(transactions, rules, use_llm)
        rules.save()
        sheets_client.TransactionsSheet(spreadsheet).append(transactions)
        print(f"Appended {len(transactions)} transactions to the Transactions sheet.")

    needs_review = sum(1 for t in transactions if t.needs_review)
    print(f"{needs_review} transaction(s) flagged Needs Review.")


if __name__ == "__main__":
    main()
