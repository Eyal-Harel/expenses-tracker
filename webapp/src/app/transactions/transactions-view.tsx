"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, TrashIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategorySelect, type CategoryOption } from "./category-select";
import { EditTransactionDialog, type EditableTx } from "./edit-transaction-dialog";
import { deleteTransactionsBulk, reviewTransaction, reviewTransactionsBulk } from "./review-actions";

interface TxRow {
  id: string;
  date: string;
  charge_date: string | null;
  source: string;
  merchant: string;
  amount: number;
  category: string | null;
  done_by: string | null;
  needs_review: boolean;
}

export function TransactionsView({
  transactions,
  categories,
}: {
  transactions: TxRow[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(transactions);
  const [categoryOptions, setCategoryOptions] = useState(categories);

  // One-at-a-time modal flow (unchanged in spirit from before).
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState("");
  const [modalSaving, setModalSaving] = useState(false);

  // Inline bulk-edit: staged category choices for needs_review rows, not
  // saved until "Save all" — for clearing out a big backlog (e.g. a fresh
  // account's cold-start review queue) without a click-through per row.
  const [pendingEdits, setPendingEdits] = useState<Map<string, string>>(new Map());
  const [savingAll, setSavingAll] = useState(false);

  // Full manual edit (any field), mirroring direct-cell-editing in the Sheet.
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingTx = rows.find((r) => r.id === editingId) ?? null;

  // Bulk delete: checkbox-select rows, confirm once, delete in one call.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  const needsReview = rows.filter((r) => r.needs_review);
  const current = needsReview[0];
  const matchingCurrentMerchant = current ? needsReview.filter((r) => r.merchant === current.merchant) : [];

  function applyLocalUpdates(updates: { id: string; category: string }[]) {
    const byId = new Map(updates.map((u) => [u.id, u.category]));
    setRows((prev) =>
      prev.map((r) => (byId.has(r.id) ? { ...r, category: byId.get(r.id)!, needs_review: false, done_by: "Manual" } : r)),
    );
    setPendingEdits((prev) => {
      const next = new Map(prev);
      for (const u of updates) next.delete(u.id);
      return next;
    });
  }

  function handleCategoryCreated(cat: CategoryOption) {
    setCategoryOptions((prev) => [...prev, cat]);
  }

  function handleTxSaved(tx: EditableTx) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === tx.id
          ? { ...r, ...tx, needs_review: false, done_by: "Manual" }
          : r,
      ),
    );
    router.refresh();
  }

  function handleTxDeleted(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  function toggleRowSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function handleDeleteSelected() {
    setDeleting(true);
    try {
      const ids = [...selectedIds];
      await deleteTransactionsBulk(ids);
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setConfirmingDelete(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleSaveNext() {
    if (!current || !modalCategory) return;
    setModalSaving(true);
    try {
      await reviewTransaction({ transactionId: current.id, merchant: current.merchant, category: modalCategory });
      applyLocalUpdates([{ id: current.id, category: modalCategory }]);
      setModalCategory("");
      if (needsReview.length === 1) setModalOpen(false);
      router.refresh();
    } finally {
      setModalSaving(false);
    }
  }

  async function handleSaveApplyAll() {
    if (!current || !modalCategory) return;
    setModalSaving(true);
    try {
      const items = matchingCurrentMerchant.map((r) => ({
        transactionId: r.id,
        merchant: r.merchant,
        category: modalCategory,
      }));
      await reviewTransactionsBulk(items);
      applyLocalUpdates(items.map((i) => ({ id: i.transactionId, category: i.category })));
      setModalCategory("");
      if (needsReview.length === matchingCurrentMerchant.length) setModalOpen(false);
      router.refresh();
    } finally {
      setModalSaving(false);
    }
  }

  async function handleSaveAllInline() {
    if (pendingEdits.size === 0) return;
    setSavingAll(true);
    try {
      const items = [...pendingEdits.entries()].map(([id, category]) => {
        const row = rows.find((r) => r.id === id)!;
        return { transactionId: id, merchant: row.merchant, category };
      });
      await reviewTransactionsBulk(items);
      applyLocalUpdates(items.map((i) => ({ id: i.transactionId, category: i.category })));
      router.refresh();
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <>
      {needsReview.length > 0 && (
        <div className="flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950">
          <span>
            {needsReview.length} transaction{needsReview.length === 1 ? "" : "s"} need review — the category shown
            is a guess, not confirmed. Pick a category directly in the table below, or review them one at a time.
          </span>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Review now
          </Button>
        </div>
      )}

      {pendingEdits.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <span>
            {pendingEdits.size} categor{pendingEdits.size === 1 ? "y" : "ies"} chosen, not yet saved.
          </span>
          <Button size="sm" onClick={handleSaveAllInline} disabled={savingAll}>
            {savingAll ? "Saving…" : `Save all (${pendingEdits.size})`}
          </Button>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <span>
            {selectedIds.size} transaction{selectedIds.size === 1 ? "" : "s"} selected.
          </span>
          <Button size="sm" variant="destructive" onClick={() => setConfirmingDelete(true)}>
            <TrashIcon /> Delete selected
          </Button>
        </div>
      )}

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} transaction{selectedIds.size === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteSelected} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What category is this?</DialogTitle>
            <DialogDescription>
              {needsReview.length} left to review. Fixing this teaches the app — every future transaction from this
              merchant will use the category you pick.
            </DialogDescription>
          </DialogHeader>

          {current && (
            <div className="flex flex-col gap-3 py-2">
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">{current.merchant}</div>
                <div className="text-muted-foreground">
                  {current.source} · {current.date} · {current.amount.toFixed(2)} ₪
                </div>
              </div>

              <CategorySelect
                value={modalCategory}
                onChange={setModalCategory}
                categories={categoryOptions}
                onCategoryCreated={handleCategoryCreated}
                className="w-full"
              />
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {matchingCurrentMerchant.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveApplyAll}
                disabled={!modalCategory || modalSaving}
                className="w-full"
              >
                {modalSaving ? "Saving…" : `Apply to all ${matchingCurrentMerchant.length} matching "${current?.merchant}"`}
              </Button>
            )}
            <Button type="button" onClick={handleSaveNext} disabled={!modalCategory || modalSaving} className="w-full">
              {modalSaving ? "Saving…" : "Save and next"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="[&>th]:font-bold [&>th]:text-foreground">
              <TableHead className="w-8">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Done by</TableHead>
              <TableHead>Review</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t, i) => (
              <TableRow key={t.id} className={i % 2 === 1 ? "bg-muted/40" : ""}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-foreground"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleRowSelected(t.id)}
                    aria-label={`Select ${t.merchant}`}
                  />
                </TableCell>
                <TableCell>{t.date}</TableCell>
                <TableCell>{t.source}</TableCell>
                <TableCell className="max-w-xs truncate">{t.merchant}</TableCell>
                <TableCell className="text-right">{t.amount.toFixed(2)}</TableCell>
                <TableCell>
                  {t.needs_review ? (
                    <CategorySelect
                      value={pendingEdits.get(t.id) ?? ""}
                      onChange={(v) =>
                        setPendingEdits((prev) => {
                          const next = new Map(prev);
                          next.set(t.id, v);
                          return next;
                        })
                      }
                      categories={categoryOptions}
                      onCategoryCreated={handleCategoryCreated}
                      className="w-full"
                    />
                  ) : (
                    (t.category ?? <span className="text-muted-foreground">—</span>)
                  )}
                </TableCell>
                <TableCell>{t.done_by ?? <span className="text-muted-foreground">Pending</span>}</TableCell>
                <TableCell>{t.needs_review && <Badge variant="destructive">Review</Badge>}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => setEditingId(t.id)}>
                    <PencilIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditTransactionDialog
        transaction={editingTx}
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
        categories={categoryOptions}
        onCategoryCreated={handleCategoryCreated}
        onSaved={handleTxSaved}
        onDeleted={handleTxDeleted}
      />
    </>
  );
}
