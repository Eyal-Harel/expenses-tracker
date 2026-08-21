"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategorySelect, type CategoryOption } from "@/app/transactions/category-select";
import { createRule, deleteRule, updateRule } from "./actions";

interface Rule {
  id: string;
  merchant: string;
  category: string;
}

export function RulesView({ rules, categories }: { rules: Rule[]; categories: CategoryOption[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(rules);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newMerchant, setNewMerchant] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.merchant.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = [...filtered].sort((a, b) => a.merchant.localeCompare(b.merchant));

  function handleCategoryCreated(cat: CategoryOption) {
    setCategoryOptions((prev) => [...prev, cat]);
  }

  async function handleCategoryChange(id: string, category: string) {
    setSavingId(id);
    try {
      await updateRule({ id, category });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category } : r)));
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id);
    try {
      await deleteRule(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    if (!newMerchant.trim() || !newCategory) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await createRule({ merchant: newMerchant.trim(), category: newCategory });
      setRows((prev) => [...prev.filter((r) => r.merchant !== created.merchant), created]);
      setNewMerchant("");
      setNewCategory("");
      router.refresh();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add that rule.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md border p-4">
        <p className="text-sm font-medium">Add a rule</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="new-rule-merchant" className="text-xs text-muted-foreground">
              Merchant
            </label>
            <Input
              id="new-rule-merchant"
              value={newMerchant}
              onChange={(e) => setNewMerchant(e.target.value)}
              placeholder="Exact merchant text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Category</span>
            <CategorySelect
              value={newCategory}
              onChange={setNewCategory}
              categories={categoryOptions}
              onCategoryCreated={handleCategoryCreated}
            />
          </div>
          <Button type="button" onClick={handleAdd} disabled={!newMerchant.trim() || !newCategory || adding}>
            <PlusIcon /> {adding ? "Adding…" : "Add rule"}
          </Button>
        </div>
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </div>

      <Input
        placeholder="Search merchant or category…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-md truncate">{r.merchant}</TableCell>
                <TableCell>
                  <CategorySelect
                    value={r.category}
                    onChange={(v) => handleCategoryChange(r.id, v)}
                    categories={categoryOptions}
                    onCategoryCreated={handleCategoryCreated}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Delete rule"
                    onClick={() => handleDelete(r.id)}
                    disabled={savingId === r.id}
                  >
                    <TrashIcon />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No rules match &quot;{search}&quot;.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
