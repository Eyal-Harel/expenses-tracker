import { Fragment } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SECTION_HEADER_ROW_CLASS } from "@/lib/categories";

// Purely illustrative — random numbers regenerated on every page load, not
// tied to any real data. Deliberately narrower than the real Summary page
// (3 months, a handful of representative categories) so it reads as "here's
// the shape of it" rather than a real report.
const MONTHS = ["Month 1", "Month 2", "Month 3"];
const ROWS: { name: string; section: string; min: number; max: number }[] = [
  { name: "Salary", section: "Credits", min: 14000, max: 22000 },
  { name: "Rent", section: "Fixed Expenses", min: 3500, max: 6000 },
  { name: "Groceries", section: "Running Expenses", min: 1800, max: 3200 },
  { name: "Transportation", section: "Running Expenses", min: 250, max: 600 },
  { name: "Travel", section: "Irregular Expenses", min: 0, max: 2500 },
];

function randomAmount(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) / 10) * 10;
}

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function SampleSummaryPreview() {
  const values = new Map(ROWS.map((r) => [r.name, MONTHS.map(() => randomAmount(r.min, r.max))]));

  const sectionTotal = (section: string, monthIndex: number) =>
    ROWS.filter((r) => r.section === section).reduce((sum, r) => sum + (values.get(r.name)?.[monthIndex] ?? 0), 0);

  const expenseSections = ["Fixed Expenses", "Running Expenses", "Irregular Expenses"];
  const netIncome = (monthIndex: number) =>
    sectionTotal("Credits", monthIndex) - expenseSections.reduce((sum, s) => sum + sectionTotal(s, monthIndex), 0);

  const sections = [...new Set(ROWS.map((r) => r.section))];

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            {MONTHS.map((m) => (
              <TableHead key={m} className="text-right">
                {m}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((section) => (
            <Fragment key={section}>
              <TableRow className={SECTION_HEADER_ROW_CLASS}>
                <TableCell colSpan={MONTHS.length + 1}>{section}</TableCell>
              </TableRow>
              {ROWS.filter((r) => r.section === section).map((r) => (
                <TableRow key={r.name}>
                  <TableCell>{r.name}</TableCell>
                  {values.get(r.name)?.map((v, i) => (
                    <TableCell key={i} className="text-right">
                      {fmt(v)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}
          <TableRow className="border-t-2 font-semibold">
            <TableCell>Net income</TableCell>
            {MONTHS.map((_, i) => (
              <TableCell key={i} className="text-right">
                {fmt(netIncome(i))}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
