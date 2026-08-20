"""One-time: build the initial Category Rules table from already-categorized
example exports (the Cal and Max-local files that have a filled Category
column). Run once; after this, main.py grows the table automatically via the
LLM fallback.

Usage:
    python -m categorize.seed_rules --cal <path> --max-local <path> [--sheet]

Without --sheet, writes to data/category_rules.csv (local dev/testing).
With --sheet, requires .env vars (SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON_PATH)
and writes directly into the "Category Rules" tab of the Google Sheet.
"""

import argparse

from .parsers import cal_parser, max_parser
from .rules_store import CsvRulesStore


def build_seed_pairs(cal_path: str | None, max_local_path: str | None):
    pairs: dict[str, str] = {}
    conflicts = []
    for source_name, path, iterator in (
        ("Cal", cal_path, cal_parser.iter_seed_pairs),
        ("Max local", max_local_path, max_parser.iter_seed_pairs),
    ):
        if not path:
            continue
        for merchant, category in iterator(path):
            if merchant in pairs and pairs[merchant] != category:
                conflicts.append((merchant, pairs[merchant], category, source_name))
            pairs[merchant] = category
    return pairs, conflicts


def main():
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cal", help="Path to a categorized Cal export CSV")
    parser.add_argument("--max-local", help="Path to a categorized Max local-deals export CSV")
    parser.add_argument("--sheet", action="store_true", help="Write to the Google Sheet instead of a local CSV")
    parser.add_argument("--out", default="data/category_rules.csv", help="Local CSV output path (ignored with --sheet)")
    args = parser.parse_args()

    if not args.cal and not args.max_local:
        parser.error("Provide at least one of --cal / --max-local")

    pairs, conflicts = build_seed_pairs(args.cal, args.max_local)

    for merchant, old, new, source_name in conflicts:
        print(f"WARNING: '{merchant}' had conflicting categories ({old!r} vs {new!r} from {source_name}); keeping {new!r}")

    if args.sheet:
        import os

        from . import sheets_client

        client = sheets_client.get_client()
        spreadsheet = sheets_client.open_spreadsheet(client, os.environ["SHEET_ID"])
        store = sheets_client.get_rules_store(spreadsheet)
    else:
        store = CsvRulesStore(args.out)

    added = 0
    for merchant, category in pairs.items():
        if store.get(merchant) is None:
            store.add(merchant, category)
            added += 1
    store.save()

    print(f"Seeded {added} new merchant->category rules ({len(pairs)} found in source files).")


if __name__ == "__main__":
    main()
