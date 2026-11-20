---
name: monthly-import
description: Import a month of Bank / Cal / Max exports into the "Home | Car | Expenses" Google Sheet. Use whenever the user uploads bank or credit-card export files, asks what dates/files to bring, or asks to add a month to the sheet. Enforces the review-before-push rule - nothing unidentified reaches the sheet without the user's sign-off in chat.
---

# Monthly import (Bank / Cal / Max → Google Sheet)

Read `docs/runbook.md` first - it has the source-recognition rules, the categorization tiers and the known gotchas. This skill is the order of operations around it, plus the house rules that keep the sheet clean.

## The cycle (what "a month" is)

- Card statements are charged around the **10th**. Max and Cal both offer a monthly download that is exactly one statement (purchases from ~10th of last month to ~10th of this one); the user downloads those rather than picking dates.
- Every row carries a **Charge Date**. The Summary tab sums by charge month (`SUMIFS(... Transactions!H:H, "yyyy-mm*")`), so a statement charged 10/11 lands in the November column. There is no date filter in code - the cycle comes entirely from Charge Date.
- Bank rows are calendar-dated (Charge Date = transaction date). Bring the bank export from where the sheet currently ends up to the latest card charge date.
- Because the script only appends, the real risk from "too many dates" is **duplicates**, not the wrong month. Always dedupe.

## Steps

1. **Find what's already there.** Read the `Transactions` tab (Sheets connector) and get per-source max `Date` and the latest `Charge Date` per card. Tell the user exactly which statements / bank range are missing - and flag any statement that looks partial (far fewer rows than usual, or deal dates stopping early - it was downloaded mid-cycle).
2. **Identify each uploaded file by structure, not filename** (runbook §1). Max `.xlsx` has the month (e.g. `11/2026`) in row 3 and two tabs; Cal has `עסקאות לחיוב ב-DD/MM/YYYY` in its title; the bank export has `מתאריך: … עד: …`.
3. **Normalize inputs the parsers can't read:**
   - Bank `.xls` (FibiSave) → convert to CSV (xlrd; Excel serial dates → `DD/MM/YYYY`), and rename the `תאור` header to `תיאור`.
   - PDF statements are never imported - ask for the Excel export; use a PDF only to cross-check totals.
4. **Dry run** (`--dry-run --no-llm`) with a rules CSV built from the live `Category Rules` tab. Save inputs under `data/raw/` (gitignored).
5. **Dedupe** every parsed row against the sheet on `(Date, Source, Merchant, Amount)`; drop matches.
6. **Reconcile totals:** each card statement's parsed sum must equal its title total and the matching card debit line in the bank export. Stop and investigate any mismatch.
7. **Check FX:** USD rows must use a live rate (`api.frankfurter.dev` is allowed in the `expenses-tracker` cloud environment). If the run printed `using fallback rate`, don't push - fix the rate first. Non-USD foreign amounts (€ etc.) are not converted - convert by hand.
8. **Review gate - talk it over in chat before pushing.** Present to the user:
   - every row with **no category** after Tier 0/1/1.5, with a proposed category for each;
   - every **new rule the Max-hint tier wants to memoize** whose result looks off (e.g. an electricity bill tagged Transportation because Max calls it "דלק, חשמל וגז");
   - any refund, foreign-currency row, or one-off large amount;
   - the totals reconciliation and the count of rows to be appended.
   Do **not** write to the sheet until the user confirms. Rows the user decided on are written with `Needs Review = FALSE` (they were reviewed here); only rows the user explicitly leaves open stay `TRUE`.
9. **Push** after approval:
   - Append rules first: new `Merchant | Category` rows to `Category Rules` (only merchants not already there; skip one-off booking-reference names like `AEGEAN AIRLI00000007YDOJW`).
   - Append transactions to `Transactions` in the column order `Date | Source | Merchant | Amount | Category | Needs Review | Done by | Charge Date`, amounts rounded to 2 decimals, values as RAW.
   - In the cloud session there is no service account or Gemini key: write through the Google Sheets connector, and Claude proposes categories in step 8 instead of Gemini (`Done by = AI` for those, `Script` for rule/tier hits).
10. **Verify:** re-read the new rows' range and check the Summary month column moved by the expected amounts.
