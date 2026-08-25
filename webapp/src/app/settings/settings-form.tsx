"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearGeminiKey, saveGeminiKey } from "./actions";

export function SettingsForm({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"need-one" | "have-one">("have-one");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveGeminiKey(apiKey);
      setApiKey("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save key");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    try {
      await clearGeminiKey();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear key");
    } finally {
      setSaving(false);
    }
  }

  if (hasKey) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input value="•••••••••••••••••••••••" disabled className="max-w-xs font-mono" />
          <Button type="button" variant="outline" onClick={handleClear} disabled={saving}>
            {saving && <LoaderCircleIcon className="animate-spin" />}
            {saving ? "Clearing…" : "Clear key"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "have-one" ? "default" : "outline"}
          onClick={() => setMode("have-one")}
        >
          I already have a key
        </Button>
        <Button type="button" variant={mode === "need-one" ? "default" : "outline"} onClick={() => setMode("need-one")}>
          I don&apos;t have one yet
        </Button>
      </div>

      {mode === "need-one" ? (
        <div className="max-w-md rounded-md border border-border bg-muted/40 p-4 text-sm">
          <p className="mb-2">Gemini has a free daily quota, no credit card required:</p>
          <ol className="mb-3 list-inside list-decimal space-y-1">
            <li>
              Open{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Google AI Studio
              </a>{" "}
              and sign in with any Google account.
            </li>
            <li>Click &quot;Create API key&quot;.</li>
            <li>Copy the key and paste it below.</li>
          </ol>
          <Button type="button" variant="outline" size="sm" onClick={() => setMode("have-one")}>
            I&apos;ve got my key
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Label htmlFor="gemini-key" className="sr-only">
            Gemini API key
          </Label>
          <Input
            id="gemini-key"
            type="password"
            placeholder="Paste your Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="max-w-xs font-mono"
            autoComplete="off"
          />
          <Button type="button" onClick={handleSave} disabled={saving || !apiKey.trim()}>
            {saving && <LoaderCircleIcon className="animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
