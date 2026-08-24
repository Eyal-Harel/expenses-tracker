"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-check";
import { friendlyDbError } from "@/lib/db-error";
import { createAdminClient } from "@/lib/supabase/admin";

/** Deletes any user's account (not just your own) — same cascade-delete
 * behavior as the self-service version in settings/actions.ts, just
 * parameterized to an arbitrary target instead of "self". requireAdmin()
 * re-checks the caller server-side regardless of what the UI shows. */
export async function deleteUserAsAdmin(targetUserId: string) {
  const adminUser = await requireAdmin();
  if (targetUserId === adminUser.id) {
    throw new Error("Can't delete your own account from here — use Settings instead.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) throw new Error(friendlyDbError(error, "deleteUserAsAdmin"));

  revalidatePath("/admin");
}

// Excludes visually-ambiguous characters (0/O, 1/I/L) since these get
// typed/read by hand, not copy-pasted through a scanner.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Creates a new single-use invite code. Collisions are astronomically
 * unlikely at this volume, but retries a couple of times just in case
 * rather than failing outright. */
export async function generateInviteCode(): Promise<string> {
  await requireAdmin();
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    const { error } = await admin.from("invite_codes").insert({ code });
    if (!error) {
      revalidatePath("/admin");
      return code;
    }
    if (!error.message.includes("duplicate key")) {
      throw new Error(friendlyDbError(error, "generateInviteCode"));
    }
  }
  throw new Error("Couldn't generate a unique code — try again.");
}
