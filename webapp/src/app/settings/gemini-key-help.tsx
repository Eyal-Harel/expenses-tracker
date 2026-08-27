"use client";

import { useState } from "react";
import { CircleHelpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function GeminiKeyHelp() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon-sm" title="How do I get a Gemini API key?" onClick={() => setOpen(true)}>
        <CircleHelpIcon />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to get a Gemini API key</DialogTitle>
            <DialogDescription>Free, no credit card required.</DialogDescription>
          </DialogHeader>
          <ol className="list-inside list-decimal space-y-1 text-sm text-foreground">
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
            <li>Copy the key and paste it into the field below.</li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
