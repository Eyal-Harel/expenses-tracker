import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Nav } from "@/components/nav";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { uploadAndImport } from "./actions";

// Personalizes with whatever the user declared at onboarding (/welcome) —
// falls back to generic phrasing if they skipped it. Purely cosmetic for
// now: the app still only actually knows how to parse Bank/Cal/Max
// regardless of what's typed here — real per-provider parser selection
// waits until more than one option per slot actually exists.
function buildDescription(bankName: string | null, cardCompanies: string | null): string {
  const bank = bankName?.trim() || "your bank";
  const cards = cardCompanies?.trim() || "your credit cards";
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

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/upload" title="Import a month" />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Import a month</CardTitle>
            <CardDescription>{buildDescription(settings?.bank_name ?? null, settings?.card_companies ?? null)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={uploadAndImport} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bank">Bank export</Label>
                <Input id="bank" name="bank" type="file" accept=".csv,.xlsx" className="h-auto py-1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cal">Cal export</Label>
                <Input id="cal" name="cal" type="file" accept=".csv,.xlsx" className="h-auto py-1" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="max">Max export</Label>
                <Input id="max" name="max" type="file" accept=".csv,.xlsx" multiple className="h-auto py-1" />
              </div>
              {error && <p className="text-sm text-red-600">{decodeURIComponent(error)}</p>}
              <SubmitButton pendingText="Importing…">Import</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
