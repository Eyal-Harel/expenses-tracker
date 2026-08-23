"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBankInfo } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BankInfoForm({
  initialBankName,
  initialCardCompanies,
}: {
  initialBankName: string;
  initialCardCompanies: string;
}) {
  const router = useRouter();
  const [bankName, setBankName] = useState(initialBankName);
  const [cardCompanies, setCardCompanies] = useState(initialCardCompanies);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveBankInfo({ bankName, cardCompanies });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <Label htmlFor="bank-name" className="text-xs text-muted-foreground">
            Bank
          </Label>
          <Input
            id="bank-name"
            value={bankName}
            onChange={(e) => {
              setBankName(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Bank Leumi"
          />
        </div>
        <div className="flex min-w-40 flex-1 flex-col gap-1">
          <Label htmlFor="card-companies" className="text-xs text-muted-foreground">
            Credit card companies
          </Label>
          <Input
            id="card-companies"
            value={cardCompanies}
            onChange={(e) => {
              setCardCompanies(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Cal, Max"
          />
        </div>
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {saved && !error && <p className="text-sm text-muted-foreground">Saved.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
