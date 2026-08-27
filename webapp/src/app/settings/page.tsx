import { redirect } from "next/navigation";
import { BankInfoForm } from "@/components/bank-info-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { TutorialBanner } from "@/components/tutorial-banner";
import { createClient } from "@/lib/supabase/server";
import { DeleteAccountSection } from "./delete-account-section";
import { GeminiKeyHelp } from "./gemini-key-help";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tutorial?: string }>;
}) {
  const { tutorial } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("gemini_api_key, bank_name, card_companies")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/settings" title="Settings">
        <TutorialBanner show={tutorial === "1"} />
      </Nav>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>What do you bank with?</CardTitle>
          <CardDescription>
            Determines which upload slots show up on the Import page. Only Bank Leumi, Cal, IsraCard, and Max are
            supported today.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BankInfoForm initialBankName={settings?.bank_name ?? null} initialCardCompanies={settings?.card_companies ?? []} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-1">
            <CardTitle>Gemini API key</CardTitle>
            <GeminiKeyHelp />
          </div>
          <CardDescription>
            Used to auto-categorize transactions that don&apos;t match any existing rule. Bring your own key so your
            imports aren&apos;t limited by a shared daily quota. Without one, unrecognized transactions are just
            flagged for manual review instead of guessed.{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Get your key from Google AI Studio
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm hasKey={!!settings?.gemini_api_key} />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>Permanently delete your account and everything in it. This can&apos;t be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountSection />
        </CardContent>
      </Card>
    </div>
  );
}
