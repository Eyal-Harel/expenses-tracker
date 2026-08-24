"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateInviteCode } from "./actions";

export function GenerateCodeSection() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <p className="text-sm">
          New code: <span className="font-mono font-semibold">{code}</span>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
