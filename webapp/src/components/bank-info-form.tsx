"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBankInfo } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_BANKS, SUPPORTED_CARD_COMPANIES } from "@/lib/providers";

const NO_BANK = "__none__";

export function BankInfoForm({
  initialBankName,
  initialCardCompanies,
}: {
  initialBankName: string | null;
  initialCardCompanies: string[];
}) {
  const router = useRouter();
  const [bankName, setBankName] = useState(initialBankName ?? NO_BANK);
  const [cardCompanies, setCardCompanies] = useState<string[]>(initialCardCompanies);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveBankInfo({
        bankName: bankName === NO_BANK ? null : bankName,
        cardCompanies,
      });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="bank-name" className="text-xs text-muted-foreground">
          Bank
        </Label>
        <Select
          value={bankName}
          onValueChange={(v) => {
            setBankName(v ?? NO_BANK);
            setSaved(false);
          }}
        >
          <SelectTrigger id="bank-name" className="w-full max-w-56">
            <SelectValue>{(value: string) => (value === NO_BANK ? "Not sure / prefer not to say" : value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_BANK}>Not sure / prefer not to say</SelectItem>
            {SUPPORTED_BANKS.map((bank) => (
              <SelectItem key={bank} value={bank}>
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="card-companies" className="text-xs text-muted-foreground">
          Credit card companies
        </Label>
        <Select
          multiple
          value={cardCompanies}
          onValueChange={(v) => {
            setCardCompanies(v ?? []);
            setSaved(false);
          }}
        >
          <SelectTrigger id="card-companies" className="w-full max-w-56">
            <SelectValue>
              {(value: string[] | null) => (value?.length ? value.join(", ") : "Select your card companies")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CARD_COMPANIES.map((company) => (
              <SelectItem key={company} value={company}>
                {company}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSave} disabled={saving} className="self-start">
          {saving ? "Saving…" : "Save"}
        </Button>
        {saved && !error && <p className="text-sm text-muted-foreground">Saved.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
