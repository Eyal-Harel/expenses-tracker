import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: categoryRows } = await supabase
    .from("categories")
    .select("name, section")
    .eq("user_id", user.id)
    .order("created_at");

  const categories = categoryRows ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Nav current="/welcome" title="Welcome" />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold">Getting started</h2>
          <p className="mt-1 text-muted-foreground">
            A quick walkthrough of how this app works, one step at a time. You can come back to this page any time
            from the nav bar above.
          </p>
        </div>

        {/* Step 1: categories */}
        <Card>
          <CardHeader>
            <CardTitle>1. Choose your categories</CardTitle>
            <CardDescription>
              Every account starts with the same generic set of categories. This is a good time to make them yours —
              rename, delete, or add whatever actually matches your own spending.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm">
              These are your current categories. This would be a good time to modify them to fit your needs — of
              course, you can always come back later and change this too:
            </p>
            <div className="flex flex-col gap-3">
              {["Credits", "Fixed Expenses", "Running Expenses", "Irregular Expenses", "Excluded"].map((section) => {
                const inSection = categories.filter((c) => c.section === section);
                if (inSection.length === 0) return null;
                return (
                  <div key={section} className="flex flex-wrap items-center gap-2">
                    <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">{section}</span>
                    {inSection.map((c) => (
                      <Badge key={c.name} variant="secondary">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                );
              })}
            </div>
            <Link href="/rules" className="self-start">
              <Button variant="outline" size="sm">
                Go to Category Rules
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Step 2: import */}
        <Card>
          <CardHeader>
            <CardTitle>2. Import your first month</CardTitle>
            <CardDescription>Upload your monthly exports and let the app categorize them for you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              Right now the app understands exports from three specific sources — <strong>Bank Leumi</strong>,{" "}
              <strong>Cal</strong>, and <strong>Max</strong>. Other banks or cards aren&apos;t supported yet. You
              don&apos;t need all three every month; upload whichever ones you actually have for that period. Each
              file can be either <code>.csv</code> or <code>.xlsx</code>.
            </p>
            <Link href="/upload" className="self-start">
              <Button variant="outline" size="sm">
                Go to Import a month
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Step 3: review */}
        <Card>
          <CardHeader>
            <CardTitle>3. Review flagged transactions</CardTitle>
            <CardDescription>Most transactions get categorized automatically — some won&apos;t.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              Anything the app can&apos;t confidently categorize gets flagged as <strong>needs review</strong>{" "}
              instead of guessed. Pick a category for it once, and you can apply that same choice to every other
              transaction from the same merchant in one click — the app remembers it for next time too.
            </p>
            <Link href="/transactions" className="self-start">
              <Button variant="outline" size="sm">
                Go to Transactions
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Step 4: summary */}
        <Card>
          <CardHeader>
            <CardTitle>4. Check your Summary</CardTitle>
            <CardDescription>A month-by-month rollup of everything, grouped by category.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              Totals are grouped into Credits, Fixed Expenses, Running Expenses, and Irregular Expenses, with a net
              income line at the bottom. You can spot general trends at a glance from the cell colors — like a
              category standing out from its usual month.
            </p>
            <Link href="/summary" className="self-start">
              <Button variant="outline" size="sm">
                Go to Summary
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Step 5: optional AI key */}
        <Card>
          <CardHeader>
            <CardTitle>5. (Optional) Add your own Gemini API key</CardTitle>
            <CardDescription>Speeds up categorization for anything a rule doesn&apos;t already cover.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm">
              This is entirely optional. Without a key, unrecognized transactions are simply flagged for you to
              categorize manually — nothing breaks. With your own free Gemini key, those get auto-categorized
              instead. It&apos;s your own key and your own quota, never shared with other users.
            </p>
            <Link href="/settings" className="self-start">
              <Button variant="outline" size="sm">
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Reference: what each tab does */}
        <Card>
          <CardHeader>
            <CardTitle>What each tab does</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex gap-3">
                <dt className="w-36 shrink-0 font-medium">Import a month</dt>
                <dd className="text-muted-foreground">Upload Bank, Cal, and Max exports for a given month.</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-36 shrink-0 font-medium">Transactions</dt>
                <dd className="text-muted-foreground">
                  Browse every transaction you&apos;ve imported, and resolve anything flagged as needs review.
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-36 shrink-0 font-medium">Summary</dt>
                <dd className="text-muted-foreground">Monthly totals by category, side by side.</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-36 shrink-0 font-medium">Category Rules</dt>
                <dd className="text-muted-foreground">
                  Manage your categories and the merchant → category mappings the app has learned.
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-36 shrink-0 font-medium">Settings</dt>
                <dd className="text-muted-foreground">Add or remove your own Gemini API key.</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Everything you see here — categories, rules, and transactions — is private to your account only.
        </p>
      </div>
    </div>
  );
}
