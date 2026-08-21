import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CANONICAL_CATEGORIES } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = ["Credits", "Fixed Expenses", "Running Expenses", "Irregular Expenses"] as const;

// Section headlines share one unified style — kept visually distinct from
// the per-section highlight colors below so a "this is a section label"
// row is never confused with a "this cell changed" signal.
const SECTION_HEADER_CLASS = "bg-slate-800 text-slate-50 dark:bg-slate-700";

// Per-section tint for the "this changed" cell highlight below — mirrors
// the Google Sheet's actual conditional-formatting colors (pulled from the
// Sheet's real conditionalFormats, not guessed).
const SECTION_HIGHLIGHT: Record<string, string> = {
  Credits: "bg-green-200/70 dark:bg-green-900/50",
  "Fixed Expenses": "bg-blue-200/70 dark:bg-blue-900/50",
  "Running Expenses": "bg-orange-200/70 dark:bg-orange-900/50",
  "Irregular Expenses": "bg-purple-200/70 dark:bg-purple-900/50",
};
const TOTAL_EXPENSES_HIGHLIGHT = "bg-red-200/70 dark:bg-red-900/50";

// The Sheet's own rule highlights any 20%-or-new increase, which — tested
// against real multi-month data — lit up 46% of all cells (mostly categories
// that are naturally used only some months, not meaningful spikes). Tightened
// to require a real ₪300+ absolute jump on top of the 30%+ relative one, so
// only substantial changes stand out.
const MIN_ABSOLUTE_INCREASE = 300;
const MIN_RELATIVE_INCREASE = 0.3;

function triggersHighlight(prev: number, curr: number): boolean {
  if (curr - prev < MIN_ABSOLUTE_INCREASE) return false;
  return (prev === 0 && curr > 0) || (prev > 0 && curr > prev * (1 + MIN_RELATIVE_INCREASE));
}

// The Sheet's Net Income gradient is MIN=red / 0=white / MAX=green, not a
// simple positive/negative split — replicated here as a real interpolation
// rather than the two-color version this page had before.
const GRADIENT_RED = [229, 124, 114] as const;
const GRADIENT_WHITE = [255, 255, 255] as const;
const GRADIENT_GREEN = [107, 186, 112] as const;

function lerp(a: readonly number[], b: readonly number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function netIncomeColor(value: number, min: number, max: number): string {
  if (value >= 0) {
    const t = max > 0 ? Math.min(value / max, 1) : 0;
    const [r, g, b] = lerp(GRADIENT_WHITE, GRADIENT_GREEN, t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = min < 0 ? Math.min(value / min, 1) : 0;
  const [r, g, b] = lerp(GRADIENT_WHITE, GRADIENT_RED, t);
  return `rgb(${r}, ${g}, ${b})`;
}

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

  const netIncomeValues = months.map(netIncome);
  const netIncomeMin = Math.min(0, ...netIncomeValues);
  const netIncomeMax = Math.max(0, ...netIncomeValues);

  const fmt = (n: number) => (n === 0 ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Nav current="/summary" title="Summary" />
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      {months.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categorized transactions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:font-bold [&>th]:text-foreground">
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
                  <TableRow className={SECTION_HEADER_CLASS}>
                    <TableCell colSpan={months.length + 1} className="font-semibold">
                      {section}
                    </TableCell>
                  </TableRow>
                  {categories
                    .filter((c) => c.section === section)
                    .map((c) => (
                      <TableRow key={c.name}>
                        <TableCell className="pl-6">{c.name}</TableCell>
                        {months.map((m, i) => {
                          const value = cell(c.name, m);
                          const prevValue = i > 0 ? cell(c.name, months[i - 1]) : null;
                          const highlight =
                            prevValue !== null && triggersHighlight(prevValue, value)
                              ? SECTION_HIGHLIGHT[section]
                              : "";
                          return (
                            <TableCell key={m} className={`text-right ${highlight}`}>
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
                {months.map((m, i) => {
                  const value = totalExpenses(m);
                  const prevValue = i > 0 ? totalExpenses(months[i - 1]) : null;
                  const highlight = prevValue !== null && triggersHighlight(prevValue, value) ? TOTAL_EXPENSES_HIGHLIGHT : "";
                  return (
                    <TableCell key={m} className={`text-right ${highlight}`}>
                      {fmt(value)}
                    </TableCell>
                  );
                })}
              </TableRow>
              <TableRow className="font-semibold">
                <TableCell>Net Income</TableCell>
                {months.map((m) => {
                  const v = netIncome(m);
                  return (
                    <TableCell
                      key={m}
                      className="text-right text-black"
                      style={{ backgroundColor: netIncomeColor(v, netIncomeMin, netIncomeMax) }}
                    >
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
