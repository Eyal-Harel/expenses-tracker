"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCategory } from "./review-actions";

// "Excluded" (Irrelevant's section) isn't offered here — it's reserved for
// the one built-in catch-all, not something a user should be creating more
// of.
const CREATABLE_SECTIONS = ["Credits", "Fixed Expenses", "Running Expenses", "Irregular Expenses"] as const;

export interface CategoryOption {
  name: string;
  section: string;
}

export function CategorySelect({
  value,
  onChange,
  categories,
  onCategoryCreated,
  placeholder = "Choose a category",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryOption[];
  onCategoryCreated: (category: CategoryOption) => void;
  placeholder?: string;
  className?: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSection, setNewSection] = useState<string>(CREATABLE_SECTIONS[2]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const bySection = Map.groupBy(categories, (c) => c.section);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createCategory({ name: newName.trim(), section: newSection });
      onCategoryCreated(created);
      onChange(created.name);
      setCreateOpen(false);
      setNewName("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Couldn't create that category. Try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      {/* The "create a new category" flow is a plain button next to the
       * Select, not a SelectItem — opening a Dialog from inside a Select's
       * onValueChange caused the Select's own popup-closing lifecycle to
       * fire a stray follow-up onValueChange("") right after the real one,
       * silently wiping the just-created category. Keeping the two
       * components independent avoids that interaction entirely. */}
      <div className={`flex items-center gap-1 ${className ?? ""}`}>
        <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
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
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          title="Create a new category"
          onClick={() => setCreateOpen(true)}
        >
          <PlusIcon />
        </Button>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new category</DialogTitle>
            <DialogDescription>It&apos;ll be available to pick from now on.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-category-name">Name</Label>
              <Input
                id="new-category-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              {createError && <p className="text-sm text-red-600">{createError}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Section</Label>
              <Select value={newSection} onValueChange={(v) => setNewSection(v ?? newSection)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_SECTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
