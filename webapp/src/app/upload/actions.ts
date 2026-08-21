"use server";

import { redirect } from "next/navigation";
import { categorize } from "@/lib/categorize";
import * as bankParser from "@/lib/parsers/bank-parser";
import * as calParser from "@/lib/parsers/cal-parser";
import * as maxParser from "@/lib/parsers/max-parser";
import type { Transaction } from "@/lib/parsers/common";
import { createRulesStore } from "@/lib/rules-store";
import { createClient } from "@/lib/supabase/server";
import { xlsxSheetsToCSV } from "@/lib/xlsx";

/** Reads an uploaded file as one or more CSV-text "sheets" — a single sheet
 * for a plain .csv (or any file exceljs can't parse as .xlsx), or one entry
 * per worksheet for a real .xlsx workbook. Lets Bank/Cal/Max exports arrive
 * as either format without the parsers themselves needing to know. */
async function readFileSheets(formData: FormData, field: string): Promise<{ name: string; csv: string }[] | null> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;

  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer();
    return xlsxSheetsToCSV(buffer);
  }

  return [{ name: file.name, csv: await file.text() }];
}

export async function uploadAndImport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [bankSheets, calSheets, maxLocalSheets, maxAbroadSheets] = await Promise.all([
    readFileSheets(formData, "bank"),
    readFileSheets(formData, "cal"),
    readFileSheets(formData, "maxLocal"),
    readFileSheets(formData, "maxAbroad"),
  ]);

  if (!bankSheets && !calSheets && !maxLocalSheets && !maxAbroadSheets) {
    redirect("/upload?error=" + encodeURIComponent("Choose at least one file"));
  }

  const transactions: Transaction[] = [];
  if (bankSheets) transactions.push(...bankParser.parse(bankSheets[0].csv));
  if (calSheets) transactions.push(...(await calParser.parse(calSheets[0].csv)));

  // Max's real xlsx export has both tabs in one workbook — classify each
  // sheet by name so dropping that single file into either Max slot (or
  // both) correctly extracts and routes both tabs, not just whichever slot
  // it landed in. A plain single-tab CSV's "sheet name" is just its
  // filename, which won't match either pattern, so it falls back to
  // whichever slot it was uploaded into — the same behavior as before.
  for (const [sheets, fallbackParser] of [
    [maxLocalSheets, maxParser.parseLocal],
    [maxAbroadSheets, maxParser.parseAbroad],
  ] as const) {
    for (const sheet of sheets ?? []) {
      if (maxParser.isLocalMaxSheet(sheet.name)) {
        transactions.push(...maxParser.parseLocal(sheet.csv));
      } else if (maxParser.isAbroadMaxSheet(sheet.name)) {
        transactions.push(...maxParser.parseAbroad(sheet.csv));
      } else {
        transactions.push(...fallbackParser(sheet.csv));
      }
    }
  }

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
