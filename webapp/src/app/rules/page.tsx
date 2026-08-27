import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { TutorialBanner } from "@/components/tutorial-banner";
import { friendlyDbError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/server";
import { RulesView } from "./rules-view";

export default async function RulesPage({
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

  const [{ data: rules, error }, { data: categories }] = await Promise.all([
    supabase.from("category_rules").select("id, merchant, category"),
    supabase.from("categories").select("name, section"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/rules" title="Category Rules">
        <p className="text-sm text-muted-foreground">
          {rules?.length ?? 0} merchant{(rules?.length ?? 0) === 1 ? "" : "s"} mapped. Every future import checks
          this list before falling back to AI or manual review.
        </p>
        <TutorialBanner show={tutorial === "1"} />
      </Nav>

      {error && (
        <p className="text-sm text-red-600">
          {friendlyDbError(error, "RulesPage", "Something went wrong loading this page. Please refresh.")}
        </p>
      )}

      <RulesView rules={rules ?? []} categories={categories ?? []} />
    </div>
  );
}
