"use client";

import { Fragment, useState } from "react";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoryOption } from "@/app/transactions/category-select";
import { createCategory } from "@/app/transactions/review-actions";
import { SECTION_HEADER_ROW_CLASS } from "@/lib/categories";
import { deleteCategory, renameCategory } from "./actions";

// "Excluded" (Irrelevant's section) is deliberately not editable here — same
// restriction as the "create a new category" flow elsewhere, since it's
// reserved for the one built-in catch-all other logic relies on by name.
const SECTIONS = ["Credits", "Fixed Expenses", "Running Expenses", "Irregular Expenses", "Excluded"] as const;

export function CategoriesPanel({
  categories,
  rulesPerCategory,
  onCategoryCreated,
  onCategoryRenamed,
  onCategoryDeleted,
}: {
  categories: CategoryOption[];
  rulesPerCategory: Map<string, number>;
  onCategoryCreated: (c: CategoryOption) => void;
  onCategoryRenamed: (oldName: string, newName: string) => void;
  onCategoryDeleted: (name: string) => void;
}) {
  const [addSection, setAddSection] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ name: string; message: string } | null>(null);

  async function handleAdd() {
    if (!addSection || !addName.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const created = await createCategory({ name: addName.trim(), section: addSection });
      onCategoryCreated(created);
      setAddSection(null);
      setAddName("");
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't create that category.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    setRenaming(true);
    setRenameError(null);
    try {
      await renameCategory({ oldName: renameTarget, newName: renameValue.trim() });
      onCategoryRenamed(renameTarget, renameValue.trim());
      setRenameTarget(null);
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : "Couldn't rename that category.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete(name: string) {
    setDeletingName(name);
    setDeleteError(null);
    try {
      await deleteCategory(name);
      onCategoryDeleted(name);
    } catch (e) {
      setDeleteError({ name, message: e instanceof Error ? e.message : "Couldn't delete that category." });
    } finally {
      setDeletingName(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Merchant rules</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {SECTIONS.map((section) => {
              const inSection = categories.filter((c) => c.section === section);
              const editable = section !== "Excluded";
              return (
                <Fragment key={section}>
                  <TableRow className={SECTION_HEADER_ROW_CLASS}>
                    <TableCell colSpan={3}>{section}</TableCell>
                  </TableRow>
                  {inSection.map((c) => (
                    <Fragment key={c.name}>
                      <TableRow>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {rulesPerCategory.get(c.name) ?? 0}
                        </TableCell>
                        <TableCell>
                          {editable && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Rename category"
                                onClick={() => {
                                  setRenameTarget(c.name);
                                  setRenameValue(c.name);
                                  setRenameError(null);
                                }}
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Delete category"
                                onClick={() => handleDelete(c.name)}
                                disabled={deletingName === c.name}
                              >
                                <TrashIcon />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {deleteError?.name === c.name && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-sm text-red-600">
                            {deleteError.message}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                  {editable && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAddSection(section);
                            setAddName("");
                            setAddError(null);
                          }}
                        >
                          <PlusIcon /> Add category to {section}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addSection !== null} onOpenChange={(open) => !open && setAddSection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a category to {addSection}</DialogTitle>
            <DialogDescription>It&apos;ll be available to pick from right away.</DialogDescription>
          </DialogHeader>
          <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Category name" autoFocus />
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <DialogFooter>
            <Button onClick={handleAdd} disabled={!addName.trim() || adding}>
              {adding ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename &quot;{renameTarget}&quot;</DialogTitle>
            <DialogDescription>Updates every transaction and rule currently using this category too.</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          {renameError && <p className="text-sm text-red-600">{renameError}</p>}
          <DialogFooter>
            <Button onClick={handleRename} disabled={!renameValue.trim() || renaming}>
              {renaming ? "Renaming…" : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
