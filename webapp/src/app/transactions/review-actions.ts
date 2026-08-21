"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Applies a manual correction: sets the transaction's category and clears
 * needs_review, then promotes the merchant into category_rules (Tier 1) so
 * every future occurrence of this exact merchant resolves automatically —
 * the whole point of fixing it once instead of every month. */
export async function reviewTransaction(input: { transactionId: string; merchant: string; category: string }) {
  return reviewTransactionsBulk([input]);
}

/** Same as reviewTransaction, but for many rows in one round trip — used by
 * "apply to all matching" in the review modal and by the inline bulk-edit
 * table, where a user resolves several rows before saving once. Each item
 * may carry a different category; category_rules gets one upsert per
 * distinct merchant in the batch. */
export async function reviewTransactionsBulk(
  items: { transactionId: string; merchant: string; category: string }[],
) {
  if (items.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // One round trip per distinct category rather than per row — the common
  // case (apply-to-all, or a bulk save where every row happens to share a
  // category) is a single update; even a mixed-category bulk save is at
  // most a handful of round trips instead of one per transaction, which
  // matters once a cold-start review queue reaches dozens of rows.
  const idsByCategory = new Map<string, string[]>();
  for (const item of items) {
    const ids = idsByCategory.get(item.category) ?? [];
    ids.push(item.transactionId);
    idsByCategory.set(item.category, ids);
  }
  for (const [category, ids] of idsByCategory) {
    const { error } = await supabase
      .from("transactions")
      .update({ category, needs_review: false, done_by: "Manual" })
      .in("id", ids)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  const rulesByMerchant = new Map(items.map((i) => [i.merchant, i.category]));
  const { error: ruleError } = await supabase
    .from("category_rules")
    .upsert(
      [...rulesByMerchant.entries()].map(([merchant, category]) => ({ user_id: user.id, merchant, category })),
      { onConflict: "user_id,merchant" },
    );
  if (ruleError) throw new Error(ruleError.message);

  revalidatePath("/transactions");
}

/** Inserts a brand-new per-user category on the spot (used from the
 * category picker's "Create a new category" option) — mainly for other
 * users whose real-world categories don't match this account's already-
 * settled taxonomy. "Excluded" is intentionally not offered as a section
 * here; it exists only for the built-in Irrelevant catch-all. */
export async function createCategory(input: { name: string; section: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const name = input.name.trim();
  if (!name) throw new Error("Category name can't be empty");

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name, section: input.section })
    .select("name, section")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/transactions");
  return data as { name: string; section: string };
}
