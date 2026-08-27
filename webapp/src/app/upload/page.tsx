import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { uploadAndImport } from "./actions";

// Personalizes with whatever the user declared in Settings/at onboarding —
// falls back to generic phrasing if they skipped it.
function buildDescription(bankName: string | null, cardCompanies: string[]): string {
  const bank = bankName ?? "your bank";
  const cards = cardCompanies.length ? cardCompanies.join(", ") : "your credit cards";
  return `Drop in the monthly summary for ${bank} and ${cards}.`;
}

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("bank_name, card_companies")
    .eq("user_id", user.id)
    .maybeSingle();

  const bankName = settings?.bank_name ?? null;
  const cardCompanies = settings?.card_companies ?? [];
  // A user who's never declared anything (brand new, or skipped the
  // Settings/welcome picker entirely) sees every slot — filtering only
  // kicks in once they've actually told us what they use, so nothing
  // breaks for someone who hasn't engaged with that form yet.
  const hasDeclaredProviders = bankName !== null || cardCompanies.length > 0;
  const showBank = !hasDeclaredProviders || bankName !== null;
  const showCal = !hasDeclaredProviders || cardCompanies.includes("Cal");
  const showIsraCard = !hasDeclaredProviders || cardCompanies.includes("IsraCard");
  const showMax = !hasDeclaredProviders || cardCompanies.includes("Max");

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/upload" title="Import a month" />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Import a month</CardTitle>
            <CardDescription>{buildDescription(bankName, cardCompanies)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadAndImport} className="flex flex-col gap-4">
              {showBank && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bank">Bank export</Label>
                  <Input id="bank" name="bank" type="file" accept=".csv,.xlsx" className="h-auto py-1" />
                </div>
              )}
              {showCal && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cal">Cal export</Label>
                  <Input id="cal" name="cal" type="file" accept=".csv,.xlsx" className="h-auto py-1" />
                </div>
              )}
              {showIsraCard && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="isracard">IsraCard export</Label>
                  <Input id="isracard" name="isracard" type="file" accept=".csv,.xlsx" className="h-auto py-1" />
                </div>
              )}
              {showMax && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="max">Max export</Label>
                  <Input id="max" name="max" type="file" accept=".csv,.xlsx" multiple className="h-auto py-1" />
                </div>
              )}
              {!showBank && !showCal && !showIsraCard && !showMax && (
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t selected any providers in{" "}
                  <a href="/settings" className="underline">
                    Settings
                  </a>
                  .
                </p>
              )}
              {error && <p className="text-sm text-red-600">{decodeURIComponent(error)}</p>}
              <SubmitButton pendingText="Importing…">Import</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
