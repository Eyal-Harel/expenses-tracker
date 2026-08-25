"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A submit button for a plain `<form action={...}>` (no client-side
 * handler) that shows a spinner while the action is in flight — plain
 * server-action forms give zero visual feedback otherwise. Must be
 * rendered as a child of the <form> it tracks, per useFormStatus's rules
 * (can't be in the same component that renders the <form> itself).
 *
 * Note: if a form has multiple submit buttons with different formAction
 * overrides (e.g. Sign in / Create account / Sign in with Google all on
 * one form), useFormStatus can't tell which one was clicked — every
 * SubmitButton on that form shows pending together. Still a real
 * improvement over no feedback at all, and it doubles as guarding against
 * double-submitting a different action mid-flight. */
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || props.disabled}>
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}
