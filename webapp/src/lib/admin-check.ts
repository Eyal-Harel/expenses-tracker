import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Gates every admin page/action to exactly one email, set via env var.
 * Checked independently in each action, not just at the page level — a
 * Server Action is a directly callable endpoint regardless of what UI
 * renders around it, so hiding a button is never enough on its own. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/");
  }
  return user;
}
