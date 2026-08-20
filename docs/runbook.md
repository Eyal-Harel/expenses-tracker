# Runbook: operating this pipeline month to month

This is the operational manual — what to do when a new export shows up, how the categorization actually decides things, and the gotchas that aren't obvious from the code alone. If you're a fresh Claude session (or a human) with no memory of how this was built, start here.

## 1. Recognizing which file is which source

**Don't trust filenames** — they're inconsistent (e.g. a file named "Max July" can contain June-charged data; a Bank export might be named "Sheet1.csv" or "Activities.csv" depending on how it was saved). Identify by structure instead:

- **Bank**: a handful of blank/metadata rows, then a header row containing both `תאריך` and `תיאור` among its cells (found dynamically by `bank_parser.find_columns()` — column *order* varies between exports, confirmed across real downloads, so it's never assumed positionally). Single flat table, no sub-sections.
- **Cal**: has a title line early in the file reading `עסקאות לחיוב ב-DD/MM/YYYY: TOTAL ₪` — this is both the source signature and the file's charge date. May have a second section further down (`עסקאות שחויבו בדולר` / `עסקאות שוטף בחו"ל` or similar — phrasing varies) containing USD-denominated rows; detect those by a `$` in the amount cell, not by the section header text.
- **Max**: comes as **two separate files per month** — local (`עסקאות במועד החיוב`) and abroad (`עסקאות חו"ל ומט"ח`). You need both for a complete month; the local tab bundles all domestic charges into one statement date, the abroad tab gives each foreign transaction its own charge date.

## 2. Monthly workflow

1. Save new export files into `data/raw/` (gitignored — never commit real financial data). CSV only; this pipeline doesn't parse PDF or XLSX. If someone hands you a PDF bank/card statement, either ask for the CSV export instead, or use the PDF only as a cross-check on numbers already imported — don't build a PDF import path, CSV is what the parsers expect.
2. **Before running anything, check for date-range overlap with what's already in the sheet.** This bit repeatedly: exports from the same source can have overlapping windows (e.g. a "July" download that actually spans two calendar months). Pull the current per-source min/max `Date` from the `Transactions` tab, compare against the new file's range, and if there's overlap, parse the new file and diff its `(Date, Source, Merchant, Amount)` keys against what's already live before importing — don't assume a new file is 100% new data. If it turns out fully duplicate, skip it; if partially, only the genuinely-new rows should go in (`scripts/categorize/main.py` only ever *appends*, it doesn't dedupe for you).
3. Run the import:
   ```
   .venv/bin/python -m scripts.categorize.main \
     --bank "data/raw/<file>.csv" --cal "data/raw/<file>.csv" \
     --max-local "data/raw/<file>.csv" --max-abroad "data/raw/<file>.csv"
   ```
   Any subset of the four flags is fine — pass only the sources you actually have this time.
4. Check the run's output: `N transaction(s) flagged Needs Review`. Open the `Transactions` tab, filter/sort by `Needs Review = TRUE`, and either fix the category directly in the sheet, or — if it's a merchant that should *always* resolve the same way going forward — add a row to `Category Rules` (`Merchant | Category`, exact merchant string match) so future runs skip the LLM for it entirely.
5. If you're unsure whether a file will produce sensible results, use `--dry-run` (writes to `data/transactions_output.csv`, no Google credentials touched) and `--no-llm` (skips Gemini calls, just flags unresolved rows) to inspect before committing to a live write.

## 3. How categorization actually decides things (the tiers)

Every transaction goes through, in order, stopping at the first tier that resolves it:

- **Tier 0 — hard-coded rules in the parser itself** (`bank_parser.py` / `cal_parser.py` / `max_parser.py`). Things like Rent, Salary, the AM:PM/Super-Pharm amount threshold, Passport Card → Travel, the abroad-tab AliExpress/Spotify/Netflix/Lime overrides, the health-clinic name pattern. Add here when a rule is *conditional* (depends on amount, transaction type, or a fixed non-merchant pattern) — these never get memoized into the rules table, they're re-evaluated every time on purpose.
- **Tier 1 — the `Category Rules` sheet tab.** A flat `Merchant → Category` lookup, checked in `main.py`'s `categorize()`. This is where most day-to-day categorization actually happens once it's been seeded/grown — add a row here for any new merchant with a fixed, unconditional category.
- **Tier 1.5 — Max's own category hint** (`max_parser.resolve_hint()`). Runs only if Tier 1 didn't match. Uses Max's own (unreliable) category label as a heuristic — e.g. anything Max tags "food & consumption" that isn't one of the user's known grocery stores gets treated as Recreation. Whatever it resolves gets memoized into Tier 1 for next time.
- **Tier 2 — Gemini LLM fallback.** Only reached if nothing above matched. Result gets written back into `Category Rules` (so a merchant only ever needs the LLM once) and the row is flagged `Needs Review` so a human eye confirms the guess.
- **Always-manual exception**: merchants in `ALWAYS_MANUAL_MERCHANTS` (`categories.py`) skip Tier 1/2 entirely and go straight to `Needs Review` with no category — for merchants where the name genuinely can't tell you what was bought (e.g. a coupon-site merchant that could be anything from a gym membership to concert tickets).

## 4. Known limitations / things to watch for

- **Currency**: only USD (`$`) is detected and converted (via `fx_rates.py`, a live historical-rate lookup against the free Frankfurter API, cached per date, with a fixed fallback if the API is unreachable). If a Cal export ever shows a different currency symbol (€ etc.), it will silently be treated as ILS with no conversion — same bug class as the one already found and fixed for USD. Worth a quick `grep` for non-₪/non-$ symbols in a new file's amount column if anything looks off.
- **Deal date vs. Charge date**: every `Transaction` carries both. `Date` is when the purchase happened; `Charge Date` is when it actually hit the bank account (which the Summary tab's monthly rollup uses, since that's what lines up with real bank statements). Cal only exposes charge date once per file (the title line) — applied to every non-USD row in that file; USD rows get their own transaction date instead, since they're billed on a separate immediate cycle, not the main monthly bundle.
- **Gemini free-tier quota** is 20 requests/day. A normal month (a handful of genuinely new merchants) won't come close; a large batch of brand-new merchants in one run could hit it. The pipeline degrades gracefully — failed LLM calls just leave the row uncategorized and flagged, they don't crash the run.
- **Google Sheets `.clear()` doesn't fully reset a tab.** It wipes cell values but not the sheet's underlying "used range," which can cause `append_rows` to land data after a large gap of blank rows instead of at the top (bit us once on the `Transactions` tab). If a tab ever needs a full reset, delete and recreate the worksheet (`spreadsheet.del_worksheet()` then let `_get_or_create_worksheet()` rebuild it) rather than `.clear()`.
- **Bank column order is not stable** between exports — confirmed two real downloads had the same columns in different positions, plus the card-ignore description text reordered too ("5237 - כרטיסי אשראי לי" vs "כרטיסי אשראי לי - 5237"). `bank_parser.py` locates columns by header name and matches ignore-patterns by substring for exactly this reason — don't "simplify" it back to fixed positions or exact-string matching.

## 5. Where things live

- **Sheet tabs**: `Transactions` (the full log), `Category Rules` (Tier 1 lookup), `Summary` (monthly rollup by category, conditional-formatted for month-over-month jumps and a red/white/green gradient on the Net Income row), `Subscriptions & Bills` (user-maintained, not touched by the pipeline).
- **Config**: `.env` (`GEMINI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON_PATH`, `SHEET_ID`) and `service-account.json` — both gitignored, never committed.
- **`docs/apple_pay_pipeline.md`**: the separate, older Apple Pay → Sheets pipeline. Being phased out — Apple Pay transactions already show up in the regular Max exports (Apple Pay is just a payment method on the Max card, not a separate data source), so that pipeline has no unique data of its own and can eventually just be abandoned.
