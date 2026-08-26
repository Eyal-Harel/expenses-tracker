"use client";

import { useState } from "react";
import { CircleHelpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ColorLegend() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon-sm" title="What do the colors mean?" onClick={() => setOpen(true)}>
        <CircleHelpIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What the colors mean</DialogTitle>
            <DialogDescription>A quick guide to the highlighting on this page.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-block size-4 shrink-0 rounded bg-orange-200/70 dark:bg-orange-900/50" />
              <p>
                <strong>A tinted category cell</strong> means that category jumped by both{" "}
                <strong>₪300 or more</strong> and <strong>30% or more</strong> compared to the previous month (or
                went from zero to something). The color matches its section — green for Credits, blue for Fixed
                Expenses, orange for Running Expenses, purple for Irregular Expenses.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-block size-4 shrink-0 rounded bg-red-200/70 dark:bg-red-900/50" />
              <p>
                <strong>A tinted Total Expenses cell</strong> means your overall spending that month jumped by the
                same amount, same rule as above.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 inline-block size-4 shrink-0 rounded border"
                style={{ background: "linear-gradient(to right, rgb(229,124,114), white, rgb(107,186,112))" }}
              />
              <p>
                <strong>Net Income</strong> is shaded on a sliding scale from red (your most negative month) to
                white (near zero) to green (your most positive month) — not a fixed threshold, just how that month
                compares to your own range.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
