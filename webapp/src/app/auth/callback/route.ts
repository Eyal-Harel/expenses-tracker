import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google (and any future OAuth provider) redirects here with a `code` after
// the user approves sign-in on the provider's own site; exchange it for a
// Supabase session before sending them into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
    console.error("Google sign-in: exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  console.error("Google sign-in: no code in callback, provider returned:", oauthError);
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthError ?? "Could not sign in with Google")}`);
}
