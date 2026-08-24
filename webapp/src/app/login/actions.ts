"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const captchaToken = formData.get("h-captcha-response") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });

  if (error) {
    // Supabase's Auth errors (unlike raw Postgres errors) are already
    // curated for end-user display — safe to show as-is; still logged for
    // server-side visibility.
    console.error("[signIn]", error.message);
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}

export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const captchaToken = formData.get("h-captcha-response") as string;
  const inviteCode = ((formData.get("inviteCode") as string) ?? "").trim();

  if (!inviteCode) {
    redirect(`/login?error=${encodeURIComponent("An invite code is required to create an account.")}`);
  }

  // Checked (not yet claimed) before signUp() itself, so an unrelated
  // failure there (a mistyped captcha, a weak password) doesn't burn a
  // one-time code the person would then need a fresh one to retry with.
  const admin = createAdminClient();
  const { data: codeRow, error: codeError } = await admin
    .from("invite_codes")
    .select("code, used")
    .ilike("code", inviteCode)
    .maybeSingle();
  if (codeError) {
    console.error("[signUp] invite code lookup failed:", codeError.message);
    redirect(`/login?error=${encodeURIComponent("Something went wrong. Please try again.")}`);
  }
  if (!codeRow || codeRow.used) {
    redirect(`/login?error=${encodeURIComponent("Invalid or already-used invite code.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { captchaToken } });

  if (error) {
    console.error("[signUp]", error.message);
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const { error: claimError } = await admin
    .from("invite_codes")
    .update({ used: true, used_by: data.user?.id ?? null, used_at: new Date().toISOString() })
    .eq("code", codeRow.code)
    .eq("used", false);
  if (claimError) {
    // Don't block the user over this — the account already exists
    // successfully; worst case the code stays reusable, which is low-risk
    // given codes are only ever handed out personally, not published.
    console.error("[signUp] failed to mark invite code used:", claimError.message);
  }

  // Email confirmations are off for now (dev config — see supabase/config.toml),
  // so signUp already returns a live session; safe to send the user straight in.
  redirect("/");
}

export async function signInWithGoogle() {
  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    console.error("[signInWithGoogle]", error.message);
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
