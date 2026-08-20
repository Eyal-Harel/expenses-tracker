"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Applies a manual correction: sets the transaction's category and clears
 * needs_review, then promotes the merchant into category_rules (Tier 1) so
 * every future occurrence of this exact merchant resolves automatically —
 * the whole point of fixing it once instead of every month. */
export async function reviewTransaction(input: { transactionId: string; merchant: string; category: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ category: input.category, needs_review: false, done_by: "Manual" })
    .eq("id", input.transactionId)
    .eq("user_id", user.id);
  if (updateError) throw new Error(updateError.message);

  const { error: ruleError } = await supabase
    .from("category_rules")
    .upsert(
      { user_id: user.id, merchant: input.merchant, category: input.category },
      { onConflict: "user_id,merchant" },
    );
  if (ruleError) throw new Error(ruleError.message);

  revalidatePath("/transactions");
}
