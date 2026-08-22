"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "welcome-seen";

/** Shown once per browser on first visit to nudge new users toward the
 * /welcome walkthrough — easy to miss as just another nav link otherwise. */
export function FirstVisitWelcome() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // localStorage only exists client-side, so this can't be decided during
    // the initial render without risking an SSR hydration mismatch.
    if (!localStorage.getItem(STORAGE_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to expenses-tracker</DialogTitle>
          <DialogDescription>
            New here? There&apos;s a short walkthrough covering how to set up your categories, import your first
            month, and everything else the app can do.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Skip for now
          </Button>
          <Button
            onClick={() => {
              dismiss();
              router.push("/welcome");
            }}
          >
            Show me how it works
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
