import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Bypasses RLS entirely via the service_role key — only ever call this
 * from a Server Action or Route Handler ("use server" boundary), never
 * from anything that could ship this client (or the key) to the browser. */
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
