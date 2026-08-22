"use server";

import { redirect } from "next/navigation";
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

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, gemini_api_key: trimmed, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
}
