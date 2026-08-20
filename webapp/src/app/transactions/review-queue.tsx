"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reviewTransaction } from "./review-actions";

interface QueueItem {
  id: string;
  date: string;
  source: string;
  merchant: string;
  amount: number;
}

interface CategoryOption {
  name: string;
  section: string;
}

export function ReviewQueue({ items, categories }: { items: QueueItem[]; categories: CategoryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState(items);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (queue.length === 0) return null;

  const current = queue[0];
  const bySection = Map.groupBy(categories, (c) => c.section);

  async function handleSave() {
    if (!selectedCategory) return;
    setSaving(true);
    try {
      await reviewTransaction({ transactionId: current.id, merchant: current.merchant, category: selectedCategory });
      const remaining = queue.slice(1);
      setQueue(remaining);
      setSelectedCategory("");
      if (remaining.length === 0) setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950">
        <span>
          {queue.length} transaction{queue.length === 1 ? "" : "s"} need review — the category shown is a guess, not confirmed.
        </span>
        <Button size="sm" onClick={() => setOpen(true)}>
          Review now
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What category is this?</DialogTitle>
            <DialogDescription>
              {queue.length} left to review. Fixing this teaches the app — every future transaction from this
              merchant will use the category you pick.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{current.merchant}</div>
              <div className="text-muted-foreground">
                {current.source} · {current.date} · {current.amount.toFixed(2)} ₪
              </div>
            </div>

            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {[...bySection.entries()].map(([section, opts]) => (
                  <SelectGroup key={section}>
                    <SelectLabel>{section}</SelectLabel>
                    {opts.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={!selectedCategory || saving}>
              {saving ? "Saving…" : "Save and next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
