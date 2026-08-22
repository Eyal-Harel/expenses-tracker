import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Import a month" },
  { href: "/transactions", label: "Transactions" },
  { href: "/summary", label: "Summary" },
  { href: "/rules", label: "Category Rules" },
  { href: "/settings", label: "Settings" },
  { href: "/welcome", label: "How it works" },
] as const;

/** Every authenticated page's header: logo + page title (with optional
 * extra content below it, e.g. filter/import banners) on the left, nav
 * links to every other page on the right. */
export function Nav({ current, title, children }: { current: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Logo size={28} />
        </Link>
        <div>
          <h1 className="text-lg font-medium">{title}</h1>
          {children}
        </div>
      </div>
      <nav className="flex gap-4 text-sm">
        {LINKS.filter((l) => l.href !== current).map((l) => (
          <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
