import Link from "next/link";

// Every "Go to X" link on the Welcome walkthrough appends ?tutorial=1, so the
// page it lands on can show this — otherwise there's no way back to
// wherever you left off short of remembering the nav bar's "How it works"
// link exists at all.
export function TutorialBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Link href="/welcome" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
      ← Back to tutorial
    </Link>
  );
}
