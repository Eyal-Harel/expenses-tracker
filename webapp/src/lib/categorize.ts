import { ALWAYS_MANUAL_MERCHANTS } from "./categories";
import { categorizeWithLlm } from "./llm-fallback";
import * as maxParser from "./parsers/max-parser";
import type { Transaction } from "./parsers/common";
import type { RulesStore } from "./rules-store";

/** Fills in .category, .doneBy and .needsReview in place: always-manual
 * merchants first -> Tier 0 (source parsers, already applied) -> Tier 1
 * (rules table) -> Tier 1.5 (source-specific heuristics, e.g. Max's own
 * category hint) -> Tier 2 (LLM fallback, only if geminiApiKey is provided —
 * a user without their own key just gets everything flagged for manual
 * review instead, by design).
 *
 * .doneBy only ever names who actually resolved the category — "Manual" is
 * set later, by the review UI, once a person really has picked one (see
 * review-actions.ts). Nothing here sets it to "Manual" pre-emptively: a row
 * nobody has resolved yet (no rule, no key, or a failed LLM call) is left
 * with .doneBy === null, not a false claim that a human already did it. */
export async function categorize(
  transactions: Transaction[],
  rules: RulesStore,
  geminiApiKey: string | null,
  categories: readonly string[],
): Promise<void> {
  for (const t of transactions) {
    if (ALWAYS_MANUAL_MERCHANTS.has(t.merchant)) {
      t.needsReview = true;
      continue; // never guessed, never memoized — name alone can't tell you what this was
    }

    if (t.category !== null) {
      t.doneBy = "Script"; // resolved by a source parser's Tier 0 rule
      continue;
    }

    const ruleCategory = rules.get(t.merchant);
    if (ruleCategory !== null) {
      t.category = ruleCategory;
      t.doneBy = "Script";
      continue;
    }

    if (t.source === "Max" && t.hint) {
      const hintCategory = maxParser.resolveHint(t.merchant, t.hint);
      if (hintCategory !== null) {
        t.category = hintCategory;
        t.doneBy = "Script";
        rules.add(t.merchant, t.category); // memoize so future runs skip straight to Tier 1
        continue;
      }
    }

    if (geminiApiKey) {
      try {
        t.category = await categorizeWithLlm(t.merchant, t.amount, t.source, geminiApiKey, categories);
        rules.add(t.merchant, t.category);
        t.doneBy = "AI";
      } catch (e) {
        console.warn(`LLM categorization failed for '${t.merchant}' (${e}); leaving uncategorized`);
      }
    }
    t.needsReview = true;
  }
}
