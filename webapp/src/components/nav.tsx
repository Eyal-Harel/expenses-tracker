import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Import a month" },
  { href: "/transactions", label: "Transactions" },
  { href: "/summary", label: "Summary" },
] as const;

export function Nav({ current }: { current: string }) {
  return (
    <nav className="flex gap-4 text-sm">
      {LINKS.filter((l) => l.href !== current).map((l) => (
        <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
