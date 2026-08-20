import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

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

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Transactions</h1>
          {imported && (
            <p className="text-sm text-muted-foreground">Imported {imported} transaction(s).</p>
          )}
        </div>
        <Link href="/upload">
          <span className="text-sm underline">Import another month</span>
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error.message}</p>}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Done by</TableHead>
              <TableHead>Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(transactions ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.date}</TableCell>
                <TableCell>{t.source}</TableCell>
                <TableCell className="max-w-xs truncate">{t.merchant}</TableCell>
                <TableCell className="text-right">{Number(t.amount).toFixed(2)}</TableCell>
                <TableCell>{t.category ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{t.done_by}</TableCell>
                <TableCell>{t.needs_review && <Badge variant="destructive">Review</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
