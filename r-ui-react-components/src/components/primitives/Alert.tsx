"use client";

import { X } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import { IconButton } from "./IconButton";
import { MARK_TEXT, type StatusTone, ToneGlyph } from "../../util/tone";

/**
 * Subtle status bg + a tinted hairline (the bg alone is a weak edge against a
 * surface). Title in the tone's text-safe ink, body in primary ink: both are
 * contract pairs on the tone's subtle bg (>= 4.5:1); the glyph is the mark
 * (>= 3:1 on that bg). Secondary ink is NOT guaranteed there, so it is not used.
 */
const TONE: Record<StatusTone, { box: string; title: string }> = {
  neutral: { box: "bg-surface-1 border-border", title: "text-fg-primary" },
  info: { box: "bg-status-info-bg border-status-info/30", title: "text-fg-info" },
  success: { box: "bg-status-success-bg border-status-success/30", title: "text-fg-success" },
  warning: { box: "bg-status-warning-bg border-status-warning/30", title: "text-fg-warning" },
  error: { box: "bg-status-error-bg border-status-error/30", title: "text-fg-error" },
  serious: { box: "bg-status-serious-bg border-status-serious/30", title: "text-fg-serious" },
  stale: { box: "bg-status-stale-bg border-status-stale/30", title: "text-fg-stale" },
};

/** Spoken before the message, so the severity is not carried by colour and glyph alone. */
const STATUS_WORD: Record<StatusTone, string> = {
  neutral: "Note",
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
  serious: "Serious",
  stale: "Stale",
};

export type AlertProps = {
  tone?: StatusTone;
  /** Short headline, in the tone's ink. */
  title?: ReactNode;
  /** Replaces the tone's glyph; `null` removes it. Always decorative. */
  icon?: ReactNode;
  /** Buttons or links acting on the message, under the body. */
  actions?: ReactNode;
  /**
   * Shows a dismiss button. The alert does not hide itself: remove it in this
   * handler, and move focus somewhere sensible if the button had it.
   */
  onDismiss?: () => void;
  /** Accessible name of the dismiss button. */
  dismissLabel?: string;
  /**
   * Visually hidden severity word read ahead of the message ("Error", …). `""`
   * drops it, for a title that already says it.
   */
  statusLabel?: string;
  classNames?: SlotClassNames<"icon" | "title" | "body" | "actions">;
} & Omit<ComponentPropsWithRef<"div">, "title">;

/**
 * An inline message about the page or a region: alert / callout.
 *
 * Role follows severity: `error` and `serious` are `role="alert"` (announced
 * when inserted); the rest are `role="status"`. A static callout that is not
 * news can pass `role="note"`.
 */
export function Alert({
  tone = "info",
  title,
  icon,
  actions,
  onDismiss,
  dismissLabel = "Dismiss",
  statusLabel,
  classNames,
  className,
  children,
  ...props
}: AlertProps) {
  const word = statusLabel ?? STATUS_WORD[tone];
  // `null` removes the glyph; `??` would treat it as absent and restore it.
  const glyph = icon === undefined ? <ToneGlyph tone={tone} /> : icon;
  return (
    <div
      role={tone === "error" || tone === "serious" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-r4 rounded-md border p-r3 text-body-1 text-fg-primary",
        TONE[tone].box,
        className,
      )}
      {...props}
    >
      {glyph != null && glyph !== false && (
        // One body-1 line tall and centred, so the glyph sits on the first line
        // of text at any density or theme leading.
        <span className={cn("r-primitives-icon-slot h-lh items-center", MARK_TEXT[tone], classNames?.icon)} aria-hidden>
          {glyph}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-r6 break-words">
        {word && <span className="sr-only">{word}: </span>}
        {title != null && title !== false && (
          <p className={cn("font-semibold", TONE[tone].title, classNames?.title)}>{title}</p>
        )}
        {children != null && children !== false && (
          <div className={cn("text-fg-primary", classNames?.body)}>{children}</div>
        )}
        {actions != null && actions !== false && (
          <div className={cn("mt-r5 flex flex-wrap items-center gap-r5", classNames?.actions)}>{actions}</div>
        )}
      </div>
      {onDismiss && (
        <IconButton
          label={dismissLabel}
          icon={<X />}
          variant="ghost"
          onClick={onDismiss}
          // The square is --ICON + 2·r4 tall and the first line one body-1
          // leading; -r5 on each block side centres the glyph on that line at
          // both densities without letting the button set the alert's height.
          className="-my-r5 -me-r5 text-fg-primary"
        />
      )}
    </div>
  );
}
