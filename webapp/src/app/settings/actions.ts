"use server";

import { redirect } from "next/navigation";
import { friendlyDbError } from "@/lib/db-error";
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
