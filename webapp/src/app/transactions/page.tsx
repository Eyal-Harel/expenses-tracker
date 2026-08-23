import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { friendlyDbError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/server";
import { TransactionsView } from "./transactions-view";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; category?: string; month?: string }>;
}) {
  const { imported, category, month } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  let query = supabase.from("transactions").select("*").order("charge_date", { ascending: false });
  if (category) query = query.eq("category", category);
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    query = query.gte("charge_date", start).lt("charge_date", next);
  }

  const [{ data: transactions, error }, { data: categories }] = await Promise.all([
    query,
    supabase.from("categories").select("name, section"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/transactions" title="Transactions">
        {imported && <p className="text-sm text-muted-foreground">Imported {imported} transaction(s).</p>}
        {(category || month) && (
          <p className="text-sm text-muted-foreground">
            Filtered: {category ?? "All categories"} {month ?? ""}{" "}
            <Link href="/transactions" className="underline">
              Clear filter
            </Link>
          </p>
        )}
      </Nav>

      {error && <p className="text-sm text-red-600">{friendlyDbError(error, "TransactionsPage")}</p>}

      <TransactionsView
        transactions={(transactions ?? []).map((t) => ({
          id: t.id,
          date: t.date,
          charge_date: t.charge_date,
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
