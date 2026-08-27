"use server";

import { redirect } from "next/navigation";
import { friendlyDbError } from "@/lib/db-error";
import { isSupportedBank, isSupportedCardCompany } from "@/lib/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function saveGeminiKey(apiKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const trimmed = apiKey.trim();
  if (!trimmed) return;
  if (trimmed.length > 500) throw new Error("That doesn't look like a valid API key.");

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, gemini_api_key: trimmed, updated_at: new Date().toISOString() });
  if (error) throw new Error(friendlyDbError(error, "saveGeminiKey"));
}

export async function clearGeminiKey() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, gemini_api_key: null, updated_at: new Date().toISOString() });
  if (error) throw new Error(friendlyDbError(error, "clearGeminiKey"));
}

/** Captures which bank/card providers the user actually uses. Drives which
 * upload slots show up on /upload (see upload/page.tsx) — anything not in
 * SUPPORTED_BANKS/SUPPORTED_CARD_COMPANIES is silently dropped rather than
 * erroring, since the picker only ever offers those values in the first
 * place. */
export async function saveBankInfo(input: { bankName: string | null; cardCompanies: string[] }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const bankName = input.bankName && isSupportedBank(input.bankName) ? input.bankName : null;
  const cardCompanies = input.cardCompanies.filter(isSupportedCardCompany);

  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    bank_name: bankName,
    card_companies: cardCompanies.length ? cardCompanies : null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(friendlyDbError(error, "saveBankInfo"));
}

/** Permanently deletes the signed-in user's account and everything tied to
 * it. Doesn't need to delete transactions/category_rules/categories/
 * user_settings explicitly first — every one of those tables has
 * `on delete cascade` on its user_id foreign key, so removing the
 * auth.users row itself cascades through all of them atomically. Deleting
 * an auth.users row requires the admin API (service_role key) — regular
 * RLS-scoped clients can't do this even for their own account. No
 * redirect here: called directly from a client component (not a form
 * submission), so the caller navigates itself once this resolves. */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error(friendlyDbError(error, "deleteAccount"));

  await supabase.auth.signOut();
}
