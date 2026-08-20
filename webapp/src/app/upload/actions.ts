"use server";

import { redirect } from "next/navigation";
import { categorize } from "@/lib/categorize";
import * as bankParser from "@/lib/parsers/bank-parser";
import * as calParser from "@/lib/parsers/cal-parser";
import * as maxParser from "@/lib/parsers/max-parser";
import type { Transaction } from "@/lib/parsers/common";
import { createRulesStore } from "@/lib/rules-store";
import { createClient } from "@/lib/supabase/server";

async function readFileText(formData: FormData, field: string): Promise<string | null> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  return file.text();
}

export async function uploadAndImport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [bankContent, calContent, maxLocalContent, maxAbroadContent] = await Promise.all([
    readFileText(formData, "bank"),
    readFileText(formData, "cal"),
    readFileText(formData, "maxLocal"),
    readFileText(formData, "maxAbroad"),
  ]);

  if (!bankContent && !calContent && !maxLocalContent && !maxAbroadContent) {
    redirect("/upload?error=" + encodeURIComponent("Choose at least one file"));
  }

  const transactions: Transaction[] = [];
  if (bankContent) transactions.push(...bankParser.parse(bankContent));
  if (calContent) transactions.push(...(await calParser.parse(calContent)));
  if (maxLocalContent) transactions.push(...maxParser.parseLocal(maxLocalContent));
  if (maxAbroadContent) transactions.push(...maxParser.parseAbroad(maxAbroadContent));

  const rules = await createRulesStore(supabase, user.id);
  // Owner's key for now (BYO-key per user is a later stage) — no key means
  // every unresolved row just gets flagged for manual review instead of
  // guessed, same designed fallback as a user without their own key.
  await categorize(transactions, rules, process.env.GEMINI_API_KEY ?? null);
  await rules.save();

  const rows = transactions.map((t) => ({
    user_id: user.id,
    date: t.date,
    charge_date: t.chargeDate,
    source: t.source,
    merchant: t.merchant,
    amount: t.amount,
    category: t.category,
    needs_review: t.needsReview,
    done_by: t.doneBy,
  }));

  const { error } = await supabase
    .from("transactions")
    .upsert(rows, { onConflict: "user_id,source,merchant,date,amount" });
  if (error) {
    redirect("/upload?error=" + encodeURIComponent(error.message));
  }

  redirect(`/transactions?imported=${transactions.length}`);
}
