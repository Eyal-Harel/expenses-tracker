"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateRule(input: { id: string; category: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("category_rules")
    .update({ category: input.category })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/rules");
}

export async function deleteRule(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("category_rules").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/rules");
}

/** Adds a rule manually — teaching the app a merchant->category mapping
 * before it's ever actually been imported, not just as a side effect of
 * reviewing a transaction. */
export async function createRule(input: { merchant: string; category: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const merchant = input.merchant.trim();
  if (!merchant) throw new Error("Merchant can't be empty");

  const { data, error } = await supabase
    .from("category_rules")
    .upsert({ user_id: user.id, merchant, category: input.category }, { onConflict: "user_id,merchant" })
    .select("id, merchant, category")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/rules");
  return data as { id: string; merchant: string; category: string };
}
