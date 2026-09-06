import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";

export default async function ApplePayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts already redirects signed-out visitors to /login, but Server
  // Components shouldn't assume the request arrived through it.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/apple-pay" title="Connect Apple Pay" />

      <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-16 text-center">
        <p className="text-lg font-medium">Coming soon</p>
        <p className="max-w-md text-sm text-muted-foreground">
          A step-by-step walkthrough for setting up the iOS Shortcuts automation that logs every Apple Pay tap
          straight into your account.
        </p>
      </div>
    </div>
  );
}
