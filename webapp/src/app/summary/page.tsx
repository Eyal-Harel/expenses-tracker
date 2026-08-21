import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CANONICAL_CATEGORIES } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = ["Credits", "Fixed Expenses", "Running Expenses", "Irregular Expenses"] as const;

interface TotalRow {
  section: string;
  category: string;
  month: string; // YYYY-MM-DD (first of month)
  total: number;
}

function monthLabel(monthDate: string): string {
  const d = new Date(monthDate + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function SummaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const [{ data: totalsData, error }, { data: categoriesData }] = await Promise.all([
    supabase.from("monthly_category_totals").select("*"),
    supabase.from("categories").select("name, section").neq("section", "Excluded"),
  ]);

  const totals = (totalsData ?? []) as TotalRow[];
  const months = [...new Set(totals.map((t) => t.month))].sort();

  const categoryOrder = new Map(CANONICAL_CATEGORIES.map((name, i) => [name, i]));
  const categories = (categoriesData ?? []).sort(
    (a, b) => (categoryOrder.get(a.name) ?? 999) - (categoryOrder.get(b.name) ?? 999),
  );

  const byKey = new Map(totals.map((t) => [`${t.category}|${t.month}`, t.total]));
  const cell = (category: string, month: string) => byKey.get(`${category}|${month}`) ?? 0;

  const sectionTotal = (section: string, month: string) =>
    categories.filter((c) => c.section === section).reduce((sum, c) => sum + cell(c.name, month), 0);

  const expenseSections = ["Fixed Expenses", "Running Expenses", "Irregular Expenses"];
  const totalExpenses = (month: string) => expenseSections.reduce((sum, s) => sum + sectionTotal(s, month), 0);
  const netIncome = (month: string) => sectionTotal("Credits", month) - totalExpenses(month);

  const fmt = (n: number) => (n === 0 ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Summary</h1>
        <Nav current="/summary" />
      </div>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {months.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categorized transactions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                {months.map((m) => (
                  <TableHead key={m} className="text-right">
                    {monthLabel(m)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {SECTIONS.map((section) => (
                <Fragment key={section}>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={months.length + 1} className="font-medium">
                      {section}
                    </TableCell>
                  </TableRow>
                  {categories
                    .filter((c) => c.section === section)
                    .map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="pl-6">{c.name}</TableCell>
                        {months.map((m) => {
                          const value = cell(c.name, m);
                          return (
                            <TableCell key={m} className="text-right">
                              {value === 0 ? (
                                "—"
                              ) : (
                                <Link
                                  href={`/transactions?category=${encodeURIComponent(c.name)}&month=${m.slice(0, 7)}`}
                                  className="hover:underline"
                                >
                                  {fmt(value)}
                                </Link>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  {section !== "Credits" && (
                    <TableRow key={`${section}-total`} className="font-medium">
                      <TableCell className="pl-6">Total {section}</TableCell>
                      {months.map((m) => (
                        <TableCell key={m} className="text-right">
                          {fmt(sectionTotal(section, m))}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </Fragment>
              ))}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>Total Expenses</TableCell>
                {months.map((m) => (
                  <TableCell key={m} className="text-right">
                    {fmt(totalExpenses(m))}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>Net Income</TableCell>
                {months.map((m) => {
                  const v = netIncome(m);
                  return (
                    <TableCell key={m} className={`text-right ${v < 0 ? "text-red-600" : "text-green-700"}`}>
                      {v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
