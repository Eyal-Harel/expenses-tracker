import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects signed-out visitors to /login before this
  // renders, but Server Components should never assume a request got here
  // through the proxy — always verify locally too.
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-muted-foreground">Signed in as {user.email}</p>
      <div className="flex gap-2">
        <Link href="/upload">
          <Button>Import a month</Button>
        </Link>
        <Link href="/transactions">
          <Button variant="outline">View transactions</Button>
        </Link>
        <Link href="/summary">
          <Button variant="outline">Summary</Button>
        </Link>
      </div>
      <form action={signOut}>
        <Button variant="outline" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
