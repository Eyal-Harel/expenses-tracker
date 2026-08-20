# Apple Pay → Google Sheets pipeline (v1, separate from this repo's Phase 1 work)

Every Apple Pay tap on one card automatically logs a categorized transaction to Google Sheets — no manual entry, no subscription app. Built entirely in iOS Shortcuts + Google Apps Script, outside this repo. Left untouched by the Phase 1 work here (see the plan at implementation time), which writes to a separate, new Google Sheet instead.

## Architecture

1. **Trigger**: iOS Shortcuts automation "When I tap my [card]" (Apple Pay automation trigger).
2. **Extract fields**: insert the Shortcut Input magic variable, then change its type/property to Merchant, Amount, or Card/Pass to pull each field directly. Do **not** use "Get Dictionary Value" here — these are native trigger objects, not JSON dictionaries, and that action fails with a conversion error.
3. **Categorize**: "Use ChatGPT" Shortcuts action. Prompt includes merchant/amount/card plus a fixed category list (Food & Beverage, Groceries [specific merchants: am:pm / שופרסל שלי / Tiv-Taam], Transportation, Recreation, Clothing, Health, Misc), instructed to output only the category name. Output Format must be **Text** (not Dictionary/Automatic) since the response is plain text.
4. **Send to sheet**: "Get Contents of URL" → POST to a Google Apps Script Web App `/exec` URL, JSON body with card/merchant/amount/category.
5. **Apps Script `doPost`**: parses the JSON body, appends `[Date, Card, Merchant, Amount, Category]` as a new row via `getSheetByName('Transactions')` — **not** `getActiveSheet()`, which can silently drift to whatever tab was last open in the UI.
6. **Deployment**: Execute as Me, Access Anyone. **Editing the script does not update the live `/exec` endpoint** — a new deployment version must be created each time (Manage deployments → edit → New version → Deploy).

## Debugging gotchas

- A 302 redirect to `script.googleusercontent.com/macros/echo` on POST is the normal successful response — not an error. The script has already run by the time that redirect comes back.
- Visiting `/exec` directly in a browser gives "Script function not found: doGet" — expected, since only `doPost` is defined; this doesn't test the real flow.
- Mock-test without a real purchase:
  ```
  curl -X POST <exec-url> -H "Content-Type: application/json" -d '{"card":"...","merchant":"...","amount":"...","category":"..."}'
  ```
  Isolates the Sheets side from Shortcuts.

## Sheet structure

- Tab 1 `Transactions`: raw log, one row per Apple Pay purchase (Date/Card/Merchant/Amount/Category).
- Tab 2: manual monthly rollup by category, covering all spending (not just Apple Pay).

## Motivation

Apple Wallet's built-in categorization only looks back ~1 week and doesn't aggregate/group — this pipeline gives permanent, structured history instead.
