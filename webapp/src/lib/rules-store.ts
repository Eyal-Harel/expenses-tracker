import type { SupabaseClient } from "@supabase/supabase-js";

export interface RulesStore {
  get(merchant: string): string | null;
  add(merchant: string, category: string): void;
  /** Flushes pending adds to the database. Uses upsert (on the (user_id,
   * merchant) unique constraint from the schema migration), so re-adding the
   * same merchant within one run is safe and never creates duplicates —
   * an improvement over the Python version's blind append, which relied on
   * the caller never adding the same key twice in one run. */
  save(): Promise<void>;
}

/** Supabase-backed Tier 1 rules table, scoped to one user (RLS enforces this
 * too, but scoping the query explicitly keeps intent clear). Loads every
 * existing rule into memory once, mirroring the Python SheetsRulesStore's
 * "read the whole sheet once, then work in-memory" shape. */
export async function createRulesStore(supabase: SupabaseClient, userId: string): Promise<RulesStore> {
  const { data, error } = await supabase.from("category_rules").select("merchant, category").eq("user_id", userId);
  if (error) throw error;

  const rules = new Map<string, string>();
  for (const row of data ?? []) {
    const merchant = (row.merchant ?? "").trim();
    const category = (row.category ?? "").trim();
    if (merchant && category) rules.set(merchant, category);
  }

  let pending: { user_id: string; merchant: string; category: string }[] = [];

  return {
    get(merchant: string) {
      return rules.get(merchant.trim()) ?? null;
    },
    add(merchant: string, category: string) {
      const key = merchant.trim();
      rules.set(key, category);
      pending.push({ user_id: userId, merchant: key, category });
    },
    async save() {
      if (pending.length === 0) return;
      const { error: upsertError } = await supabase
        .from("category_rules")
        .upsert(pending, { onConflict: "user_id,merchant" });
      if (upsertError) throw upsertError;
      pending = [];
    },
  };
}
