"use server";

import { redirect } from "next/navigation";
import { categorize } from "@/lib/categorize";
import { friendlyDbError } from "@/lib/db-error";
import * as bankParser from "@/lib/parsers/bank-parser";
import * as calParser from "@/lib/parsers/cal-parser";
import * as isracardParser from "@/lib/parsers/isracard-parser";
import * as maxParser from "@/lib/parsers/max-parser";
import type { Transaction } from "@/lib/parsers/common";
import { createRulesStore } from "@/lib/rules-store";
import { createClient } from "@/lib/supabase/server";
import { xlsxSheetsToCSV } from "@/lib/xlsx";

// Generous safety valves, not tight limits — these are monthly card/bank
// statements, plausibly spanning many months in one file, not bulk data.
// They exist only to catch an obviously-wrong file (a PDF, a video, an
// unrelated huge export), not to constrain a real one.
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_TRANSACTIONS = 50_000;

async function readSheetsFromFile(file: File): Promise<{ name: string; csv: string }[]> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`"${file.name}" is too large (over 20MB) — is this the right file?`);
  }
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const buffer = await file.arrayBuffer();
    return xlsxSheetsToCSV(buffer);
  }
  return [{ name: file.name, csv: await file.text() }];
}

/** Reads a single-file field ("bank"/"cal") as one or more CSV-text
 * "sheets" — a single sheet for a plain .csv (or any file exceljs can't
 * parse as .xlsx), or one entry per worksheet for a real .xlsx workbook. */
async function readFileSheets(formData: FormData, field: string): Promise<{ name: string; csv: string }[] | null> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  return readSheetsFromFile(file);
}

/** Reads a multi-file field ("max") — each selected file contributes its
 * own sheet(s): a combined .xlsx contributes both tabs, a plain .csv
 * contributes one sheet named for its filename. */
async function readAllFileSheets(formData: FormData, field: string): Promise<{ name: string; csv: string }[]> {
  const files = formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
  const sheetLists = await Promise.all(files.map(readSheetsFromFile));
  return sheetLists.flat();
}

export async function uploadAndImport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const transactions: Transaction[] = [];
  try {
    const [bankSheets, calSheets, isracardSheets, maxSheets] = await Promise.all([
      readFileSheets(formData, "bank"),
      readFileSheets(formData, "cal"),
      readFileSheets(formData, "isracard"),
      readAllFileSheets(formData, "max"),
    ]);

    if (!bankSheets && !calSheets && !isracardSheets && maxSheets.length === 0) {
      throw new Error("Choose at least one file");
    }

    if (bankSheets) transactions.push(...bankParser.parse(bankSheets[0].csv));
    if (calSheets) transactions.push(...(await calParser.parse(calSheets[0].csv)));
    if (isracardSheets) transactions.push(...isracardParser.parse(isracardSheets[0].csv));

    // Max's real xlsx export has both tabs in one workbook — classify each
    // sheet by name so a single combined file correctly splits into both,
    // regardless of how many separate files were selected in this one
    // multi-file field. A plain .csv's "sheet name" is just its filename;
    // if that doesn't recognizably say local/abroad, don't guess (there's
    // no longer a separate upload slot to fall back on) — ask for the
    // combined .xlsx instead, or the .csv exactly as Max named it.
    for (const sheet of maxSheets) {
      if (maxParser.isLocalMaxSheet(sheet.name)) {
        transactions.push(...maxParser.parseLocal(sheet.csv));
      } else if (maxParser.isAbroadMaxSheet(sheet.name)) {
        transactions.push(...maxParser.parseAbroad(sheet.csv));
      } else {
        throw new Error(
          `Couldn't tell whether "${sheet.name}" is a local or abroad Max export. Upload the combined .xlsx file instead, or use the .csv exactly as Max named it.`,
        );
      }
    }

    if (transactions.length > MAX_TRANSACTIONS) {
      throw new Error(`That's ${transactions.length} transactions in one import — is this the right file?`);
    }
  } catch (e) {
    redirect("/upload?error=" + encodeURIComponent(e instanceof Error ? e.message : "Couldn't read that file."));
  }

  const rules = await createRulesStore(supabase, user.id);
  // BYO only: each user's own key (set on /settings), or no key at all. No
  // shared fallback — a user without their own key just gets everything
  // flagged for manual review instead of guessed, by design.
  const { data: settings } = await supabase
    .from("user_settings")
    .select("gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();
  const geminiApiKey = settings?.gemini_api_key ?? null;
  const { data: categoryRows } = await supabase.from("categories").select("name").eq("user_id", user.id);
  const categories = (categoryRows ?? []).map((c) => c.name);
  await categorize(transactions, rules, geminiApiKey, categories);
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
    .upsert(rows, { onConflict: "user_id,source,merchant,date,amount,charge_date" });
  if (error) {
    redirect("/upload?error=" + encodeURIComponent(friendlyDbError(error, "uploadAndImport")));
  }

  redirect(`/transactions?imported=${transactions.length}`);
}
