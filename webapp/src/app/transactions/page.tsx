import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { TransactionsView } from "./transactions-view";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string }>;
}) {
  const { imported } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: transactions, error }, { data: categories }] = await Promise.all([
    supabase.from("transactions").select("*").order("date", { ascending: false }),
    supabase.from("categories").select("name, section"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Transactions</h1>
          {imported && (
            <p className="text-sm text-muted-foreground">Imported {imported} transaction(s).</p>
          )}
        </div>
        <Nav current="/transactions" />
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <TransactionsView
        transactions={(transactions ?? []).map((t) => ({
          id: t.id,
          date: t.date,
          source: t.source,
          merchant: t.merchant,
          amount: Number(t.amount),
          category: t.category,
          done_by: t.done_by,
          needs_review: t.needs_review,
        }))}
        categories={categories ?? []}
      />
    </div>
  );
}
