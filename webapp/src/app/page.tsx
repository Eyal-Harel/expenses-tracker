import Link from "next/link";
import { UploadIcon, ReceiptIcon, ChartColumnIcon, TagsIcon, CircleHelpIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";
import { FirstVisitWelcome } from "@/components/first-visit-welcome";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

const TILES = [
  { href: "/upload", label: "Import a month", description: "Upload Bank, Cal, and Max exports", Icon: UploadIcon },
  { href: "/transactions", label: "Transactions", description: "Browse and review every transaction", Icon: ReceiptIcon },
  { href: "/summary", label: "Summary", description: "Monthly totals by category", Icon: ChartColumnIcon },
  { href: "/rules", label: "Category Rules", description: "Manage merchant → category mappings", Icon: TagsIcon },
] as const;

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
    <div className="relative flex flex-1 flex-col items-center justify-center gap-10 p-8">
      <FirstVisitWelcome />
      <div className="absolute top-8 right-8 flex gap-2">
        <Link href="/settings">
          <Button variant="outline" size="icon-lg" title="Settings">
            <SettingsIcon className="size-5" />
          </Button>
        </Link>
        <Link href="/welcome">
          <Button variant="outline" size="lg">
            <CircleHelpIcon className="size-5" />
            How it works
          </Button>
        </Link>
      </div>
      <Wordmark className="scale-125" />
      <p className="text-muted-foreground">Signed in as {user.email}</p>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        {TILES.map(({ href, label, description, Icon }) => (
          <Link key={href} href={href}>
            <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm transition-all hover:border-primary hover:shadow-md">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <Icon className="size-7 text-primary" />
              </div>
              <div className="text-lg font-semibold">{label}</div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
      <form action={signOut}>
        <Button variant="outline" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
