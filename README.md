# expenses-tracker

Monthly script that turns Bank / Cal / Max exports into categorized rows in a Google Sheet, using a merchant→category rules table with an LLM fallback for anything new. See `docs/apple_pay_pipeline.md` for the separate, existing Apple Pay → Sheets pipeline (untouched by this).

**Start with [`docs/runbook.md`](docs/runbook.md)** for the operational manual — how to recognize which export is which, the monthly workflow (including avoiding duplicate imports), how the categorization tiers actually decide things, and known gotchas. This file below is just setup + command reference.

## Setup

```
python3.11 -m venv .venv
.venv/bin/pip install -r scripts/categorize/requirements.txt
cp .env.example .env   # then fill in GEMINI_API_KEY, GOOGLE_SERVICE_ACCOUNT_JSON_PATH, SHEET_ID
```

## One-time: seed the Category Rules table

From already-categorized example exports:

```
.venv/bin/python -m scripts.categorize.seed_rules \
  --cal "data/raw/<cal export>.csv" \
  --max-local "data/raw/<max local export>.csv" \
  --sheet   # omit to write to data/category_rules.csv instead, for local testing
```

## Monthly run

```
.venv/bin/python -m scripts.categorize.main \
  --bank "data/raw/<bank export>.csv" \
  --cal "data/raw/<cal export>.csv" \
  --max-local "data/raw/<max local export>.csv" \
  --max-abroad "data/raw/<max abroad export>.csv"
```

Add `--dry-run` to write to `data/transactions_output.csv` instead of the Sheet (no Google credentials needed). Add `--no-llm` to skip Gemini calls entirely — unresolved transactions are just flagged `Needs Review` with no category, useful for testing the rule layers in isolation.

After each run, review rows flagged `Needs Review` in the `Transactions` tab, and add clean entries to `Category Rules` for any merchant that should always resolve deterministically going forward.

Real exports (`data/raw/`) are gitignored — never commit real financial data.
