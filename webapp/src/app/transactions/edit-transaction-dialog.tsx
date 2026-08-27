"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategorySelect, type CategoryOption } from "./category-select";
import { deleteTransaction, updateTransaction } from "./review-actions";

const SOURCES = ["Bank", "Cal", "Max", "IsraCard"] as const;

export interface EditableTx {
  id: string;
  date: string;
  charge_date: string | null;
  source: string;
  merchant: string;
  amount: number;
  category: string | null;
}

export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
  categories,
  onCategoryCreated,
  onSaved,
  onDeleted,
}: {
  transaction: EditableTx | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  onCategoryCreated: (category: CategoryOption) => void;
  onSaved: (tx: EditableTx) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {transaction && (
          // Keyed by id so switching which row is being edited mounts a
          // fresh form (state initialized straight from props) instead of
          // needing an effect to re-seed state from a changed prop.
          <EditTransactionForm
            key={transaction.id}
            transaction={transaction}
            categories={categories}
            onCategoryCreated={onCategoryCreated}
            onSaved={(tx) => {
              onSaved(tx);
              onOpenChange(false);
            }}
            onDeleted={(id) => {
              onDeleted(id);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditTransactionForm({
  transaction,
  categories,
  onCategoryCreated,
  onSaved,
  onDeleted,
}: {
  transaction: EditableTx;
  categories: CategoryOption[];
  onCategoryCreated: (category: CategoryOption) => void;
  onSaved: (tx: EditableTx) => void;
  onDeleted: (id: string) => void;
}) {
  const [date, setDate] = useState(transaction.date);
  const [chargeDate, setChargeDate] = useState(transaction.charge_date ?? "");
  const [source, setSource] = useState(transaction.source);
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [category, setCategory] = useState(transaction.category ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!date || !merchant.trim() || !category || Number.isNaN(parsedAmount)) {
      setError("Date, merchant, amount, and category are all required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateTransaction({
        id: transaction.id,
        date,
        chargeDate: chargeDate || null,
        source,
        merchant: merchant.trim(),
        amount: parsedAmount,
        category,
      });
      onSaved({
        id: transaction.id,
        date,
        charge_date: chargeDate || null,
        source,
        merchant: merchant.trim(),
        amount: parsedAmount,
        category,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTransaction(transaction.id);
      onDeleted(transaction.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that transaction.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit transaction</DialogTitle>
        <DialogDescription>Change any field directly, same as editing a row in the Sheet.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-charge-date">Charge date</Label>
            <Input id="edit-charge-date" type="date" value={chargeDate} onChange={(e) => setChargeDate(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v ?? source)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-merchant">Merchant</Label>
          <Input id="edit-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-amount">Amount</Label>
          <Input id="edit-amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Category</Label>
          <CategorySelect
            value={category}
            onChange={setCategory}
            categories={categories}
            onCategoryCreated={onCategoryCreated}
            className="w-full"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving || deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
        <Button type="button" onClick={handleSave} disabled={saving || deleting}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}
