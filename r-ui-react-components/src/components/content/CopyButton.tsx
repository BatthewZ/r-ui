"use client";

import { Check, CircleAlert, Copy } from "lucide-react";
import { type MouseEvent, type ReactNode, type Ref, useEffect, useRef, useState } from "react";

import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { Button, IconButton, type IconButtonProps } from "../primitives";

type CopyState = "idle" | "copied" | "failed";

export interface CopyButtonLabels {
  /** The button's name (icon-only) or its text (with `showLabel`). Default "Copy". */
  copy?: string;
  /** Announced, and shown with `showLabel`, after a successful copy. Default "Copied". */
  copied?: string;
  /** Announced, and shown with `showLabel`, when nothing reached the clipboard. Default "Copy failed". */
  failed?: string;
}

export type CopyButtonProps = {
  /** The text that goes on the clipboard. */
  value: string;
  /** Show the label beside the icon (a `Button`). Default: icon only (an `IconButton`, named by `labels.copy`). */
  showLabel?: boolean;
  variant?: IconButtonProps["variant"];
  labels?: CopyButtonLabels;
  /** How long the confirmation stays, in ms. Default 2000. */
  resetAfter?: number;
  /** Called once per successful copy, with the value written. */
  onCopy?: (value: string) => void;
  /** Called when neither the Clipboard API nor the fallback could write. */
  onCopyError?: (error: Error) => void;
  classNames?: SlotClassNames<"icon" | "status">;
  ref?: Ref<HTMLButtonElement>;
} & Omit<IconButtonProps, "label" | "icon" | "value" | "variant" | "ref">;

const DEFAULT_LABELS: Required<CopyButtonLabels> = { copy: "Copy", copied: "Copied", failed: "Copy failed" };

/**
 * `document.execCommand("copy")` from a hidden textarea, for where the Clipboard
 * API is missing (an insecure context) or refused (no permission, no focus).
 *
 * The textarea goes next to the button, not on `<body>`: inside a modal
 * `<dialog>` everything outside it is inert, a selection there is impossible and
 * the copy silently writes nothing. Focus goes back to the button afterwards.
 */
function legacyCopy(value: string, near: HTMLElement | null): boolean {
  const host = near?.parentElement ?? document.body;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.tabIndex = -1;
  // Fixed and transparent: never laid out in the caller's flow, never seen.
  area.style.position = "fixed";
  area.style.insetBlockStart = "0";
  area.style.insetInlineStart = "0";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  host.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  near?.focus();
  return ok;
}

async function writeClipboard(value: string, near: HTMLElement | null): Promise<void> {
  let apiError: unknown = null;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      apiError = error;
    }
  }
  if (legacyCopy(value, near)) return;
  throw apiError ?? new Error("Clipboard unavailable");
}

/**
 * Copies `value` to the clipboard: the Clipboard API, falling back to a
 * selection copy where that API is missing or refused. Icon-only by default (an
 * `IconButton`: a compact square with a `--HIT-MIN` hit area); `showLabel` makes
 * it a labelled `Button`.
 *
 * The icon swaps to a check (or an alert on failure) for `resetAfter` ms, with
 * the contract's motion tokens, and the outcome is announced politely by a
 * status region beside the button (a live region inside a button is
 * presentational and never read). The button's own name stays "Copy": an
 * announcement is what tells, a changing name is noise on the next focus.
 * Success is a glyph and an announcement (and, labelled, text), never a colour,
 * so it survives forced colors.
 */
export function CopyButton({
  value,
  showLabel = false,
  variant = "ghost",
  labels,
  resetAfter = 2000,
  onCopy,
  onCopyError,
  classNames,
  className,
  onClick,
  disabled,
  ref,
  ...props
}: CopyButtonProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const [state, setState] = useState<CopyState>("idle");
  // Flips each time, so a second identical announcement is still a change.
  const [nonce, setNonce] = useState(false);
  const own = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const settle = (next: CopyState) => {
    if (!mounted.current) return;
    setState(next);
    setNonce((n) => !n);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setState("idle");
    }, resetAfter);
  };

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    try {
      await writeClipboard(value, own.current);
      settle("copied");
      onCopy?.(value);
    } catch (error) {
      settle("failed");
      onCopyError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const message = state === "copied" ? text.copied : state === "failed" ? text.failed : "";
  const icon: ReactNode = (
    // All three glyphs share one grid cell and cross-fade, so the box never moves.
    <span className={cn("grid size-icon place-items-center *:col-start-1 *:row-start-1", classNames?.icon)} aria-hidden>
      {(
        [
          ["idle", Copy],
          ["copied", Check],
          ["failed", CircleAlert],
        ] as const
      ).map(([key, Glyph]) => (
        <Glyph
          key={key}
          className={cn(
            "size-icon transition-[opacity,scale] duration-normal ease-standard",
            state === key ? "scale-100 opacity-100" : "scale-50 opacity-0",
            key === "failed" && "text-fg-error",
          )}
        />
      ))}
    </span>
  );

  const common = {
    ...props,
    ref: mergeRefs(own, ref),
    disabled,
    "data-state": state,
    onClick: handleClick,
  };

  return (
    <>
      {showLabel ? (
        <Button
          {...common}
          variant={variant}
          iconStart={icon}
          className={className}
        >
          {/* Every label in one cell, the inactive ones invisible (no name, no
              box change): the width holds while the text swaps. */}
          <span className="inline-grid justify-items-start *:col-start-1 *:row-start-1">
            {(["idle", "copied", "failed"] as const).map((key) => (
              <span key={key} aria-hidden={state !== key || undefined} className={cn(state !== key && "invisible")}>
                {key === "idle" ? text.copy : key === "copied" ? text.copied : text.failed}
              </span>
            ))}
          </span>
        </Button>
      ) : (
        <IconButton {...common} variant={variant} label={text.copy} icon={icon} className={className} />
      )}
      <span role="status" aria-live="polite" className={cn("sr-only", classNames?.status)}>
        {message && (nonce ? message : `${message}\u00a0`)}
      </span>
    </>
  );
}
