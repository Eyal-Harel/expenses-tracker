import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("gemini_api_key")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/settings" title="Settings" />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Gemini API key</CardTitle>
          <CardDescription>
            Used to auto-categorize transactions that don&apos;t match any existing rule. Bring your own key so your
            imports aren&apos;t limited by a shared daily quota. Without one, unrecognized transactions are just
            flagged for manual review instead of guessed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm hasKey={!!settings?.gemini_api_key} />
        </CardContent>
      </Card>
    </div>
  );
}
