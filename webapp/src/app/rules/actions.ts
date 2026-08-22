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

/** Renames a category everywhere it's referenced — categories.name itself,
 * plus every transaction and rule currently pointing at the old name by
 * plain string match (there's no foreign key; category is stored as text
 * on both tables), so nothing is silently left behind under the stale name. */
export async function renameCategory(input: { oldName: string; newName: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const newName = input.newName.trim();
  if (!newName) throw new Error("Category name can't be empty");
  if (newName === input.oldName) return;

  const { error: catError } = await supabase
    .from("categories")
    .update({ name: newName })
    .eq("user_id", user.id)
    .eq("name", input.oldName);
  if (catError) {
    throw new Error(
      catError.message.includes("duplicate key") ? "You already have a category with that name." : catError.message,
    );
  }

  const { error: txError } = await supabase
    .from("transactions")
    .update({ category: newName })
    .eq("user_id", user.id)
    .eq("category", input.oldName);
  if (txError) throw new Error(txError.message);

  const { error: ruleError } = await supabase
    .from("category_rules")
    .update({ category: newName })
    .eq("user_id", user.id)
    .eq("category", input.oldName);
  if (ruleError) throw new Error(ruleError.message);

  revalidatePath("/rules");
  revalidatePath("/transactions");
  revalidatePath("/summary");
}

/** Deletes a category outright — blocked while any transaction still uses
 * it (reassign those first; deleting out from under real categorized data
 * would just leave orphaned category strings behind). Any merchant rules
 * still pointing at it are cleared too, since a rule pointing to a category
 * that no longer exists would just re-introduce the same orphaned string on
 * the next import. */
export async function deleteCategory(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("category", name);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      `${count} transaction${count === 1 ? "" : "s"} still categorized as this — go to Transactions and reassign ` +
        `${count === 1 ? "it" : "them"} to a different category first.`,
    );
  }

  const { error: ruleError } = await supabase
    .from("category_rules")
    .delete()
    .eq("user_id", user.id)
    .eq("category", name);
  if (ruleError) throw new Error(ruleError.message);

  const { error } = await supabase.from("categories").delete().eq("user_id", user.id).eq("name", name);
  if (error) throw new Error(error.message);

  revalidatePath("/rules");
}
