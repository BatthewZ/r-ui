"use client";

import { X } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import { IconButton } from "./IconButton";
import { type LabelsProp, useLabels } from "../../util/locale";
import { MARK_TEXT, type StatusTone, type Tone, TONE_LABELS, TONE_SUBTLE_BG, TONE_TEXT, ToneGlyph } from "../../util/tone";

/**
 * Subtle status bg + a tinted hairline (the bg alone is a weak edge against a
 * surface). Title in the tone's text-safe ink, body in primary ink: both are
 * contract pairs on the tone's subtle bg (>= 4.5:1); the glyph is the mark
 * (>= 3:1 on that bg). Secondary ink is NOT guaranteed there, so it is not used:
 * a neutral title is primary ink.
 */
const EDGE: Record<StatusTone, string> = {
  neutral: "border-border",
  info: "border-status-info/30",
  success: "border-status-success/30",
  warning: "border-status-warning/30",
  error: "border-status-error/30",
  serious: "border-status-serious/30",
  stale: "border-status-stale/30",
};
const TITLE: Record<StatusTone, string> = { ...TONE_TEXT, neutral: "text-fg-primary" };

/** Whether a slot was given something to render (`null`, `undefined` and `false` render nothing). */
const isRendered = (node: ReactNode) => node != null && node !== false;

export interface AlertLabels {
  /** The dismiss button's accessible name. */
  dismiss: string;
  /**
   * The visually hidden severity word read ahead of the message, per tone. `""`
   * drops it, for a title that already says it.
   */
  tones: Record<Tone, string>;
}

export const DEFAULT_ALERT_LABELS: AlertLabels = { dismiss: "Dismiss", tones: TONE_LABELS };

declare module "../../util/locale" {
  interface LabelsRegistry {
    Alert: AlertLabels;
  }
}

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
  labels?: LabelsProp<AlertLabels>;
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
  labels: labelsProp,
  classNames,
  className,
  children,
  ...props
}: AlertProps) {
  const labels = useLabels("Alert", DEFAULT_ALERT_LABELS, labelsProp);
  const word = labels.tones[tone];
  // `null` removes the glyph; `??` would treat it as absent and restore it.
  const glyph = icon === undefined ? <ToneGlyph tone={tone} /> : icon;
  return (
    <div
      role={tone === "error" || tone === "serious" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-r4 rounded-md border p-r3 text-body-1 text-fg-primary",
        TONE_SUBTLE_BG[tone],
        EDGE[tone],
        className,
      )}
      {...props}
    >
      {isRendered(glyph) && (
        // One body-1 line tall and centred, so the glyph sits on the first line
        // of text at any density or theme leading.
        <span className={cn("r-primitives-icon-slot h-lh items-center", MARK_TEXT[tone], classNames?.icon)} aria-hidden>
          {glyph}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-r6 break-words">
        {word && <span className="sr-only">{word}: </span>}
        {isRendered(title) && (
          <p className={cn("font-semibold", TITLE[tone], classNames?.title)}>{title}</p>
        )}
        {isRendered(children) && (
          <div className={cn("text-fg-primary", classNames?.body)}>{children}</div>
        )}
        {isRendered(actions) && (
          <div className={cn("mt-r5 flex flex-wrap items-center gap-r5", classNames?.actions)}>{actions}</div>
        )}
      </div>
      {onDismiss && (
        <IconButton
          label={labels.dismiss}
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
