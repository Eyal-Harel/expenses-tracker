"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInviteCode } from "./actions";

export function GenerateCodeSection() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setCode(null);
    try {
      const newCode = await generateInviteCode();
      setCode(newCode);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate a code.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={handleGenerate} disabled={generating} className="self-start">
        {generating ? "Generating…" : "Generate a new code"}
      </Button>
      {code && (
        <p className="flex items-center gap-2 text-sm">
          New code: <span className="font-mono font-semibold">{code}</span>
          <Button type="button" variant="ghost" size="icon-sm" title="Copy code" onClick={handleCopy}>
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
