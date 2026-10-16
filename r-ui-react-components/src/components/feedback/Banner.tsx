"use client";

import { X } from "lucide-react";
import { type ComponentPropsWithRef, type ReactNode, useCallback, useId, useState, useSyncExternalStore } from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import {
  MARK_TEXT,
  type StatusTone,
  type Tone,
  TONE_BORDER,
  TONE_LABELS,
  TONE_SUBTLE_BG,
  TONE_TEXT,
  ToneGlyph,
} from "../../util/tone";
import { IconButton } from "../primitives";

export interface BannerLabels {
  /** The dismiss button's accessible name. */
  dismiss: string;
  /** The region's name when the banner has no `title`. */
  region: string;
  /** The visually hidden word read ahead of the message, per tone. `""` drops it. */
  tones: Record<Tone, string>;
}

export const DEFAULT_BANNER_LABELS: BannerLabels = { dismiss: "Dismiss", region: "Announcement", tones: TONE_LABELS };

declare module "../../util/locale" {
  interface LabelsRegistry {
    Banner: BannerLabels;
  }
}

/** Where a dismissal is remembered: `localStorage` by default, or any store with the same two calls. */
export interface BannerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type BannerProps = {
  tone?: StatusTone;
  /** Short headline, in the tone's ink; also the region's name. */
  title?: ReactNode;
  /** Replaces the tone's glyph; `null` removes it. Always decorative. */
  icon?: ReactNode;
  /** Links or buttons acting on the announcement. Screen only (`data-print="hide"`). */
  actions?: ReactNode;
  /**
   * Makes the banner dismissible: the banner hides itself, then calls this.
   * Without `dismissKey` the dismissal lasts until the banner remounts. The
   * dismiss button had focus and is about to leave: move focus somewhere
   * sensible here (the page's main heading, the next landmark).
   */
  onDismiss?: () => void;
  /**
   * Makes the banner dismissible and remembers it: the dismissal is written to
   * `storage` under this exact key (namespace it, and change it when the
   * announcement changes), and a banner whose key is stored renders nothing.
   * Other tabs sharing `localStorage` follow.
   */
  dismissKey?: string;
  /**
   * Where `dismissKey` is stored. Default `localStorage`; `null` remembers
   * nothing. Every read and write is guarded: a store that throws (private
   * mode, a full quota, a sandbox) leaves the banner showing and dismissible.
   */
  storage?: BannerStorage | null;
  /**
   * `inline` (default): a bordered box in the content. `top`: an edge-to-edge
   * band for the top of a page or app, a hairline in the tone's mark below it.
   */
  placement?: "top" | "inline";
  /** Sticks to the top of its scroller, on the sticky layer (`z-sticky`); prints in the flow. */
  sticky?: boolean;
  /**
   * `role="alert"`, announced when it appears, for an announcement that cannot
   * wait (an outage now). Otherwise the banner is a named `region`: a landmark
   * a reader can find, not news read out over whatever they were doing.
   */
  urgent?: boolean;
  labels?: LabelsProp<BannerLabels>;
  classNames?: SlotClassNames<"icon" | "title" | "body" | "actions" | "dismiss">;
} & Omit<ComponentPropsWithRef<"div">, "title">;

const DISMISSED = "dismissed";
const TITLE: Record<StatusTone, string> = { ...TONE_TEXT, neutral: "text-fg-primary" };

function defaultStorage(): BannerStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readDismissed(storage: BannerStorage | null, key: string | undefined): boolean {
  if (!storage || key === undefined) return false;
  try {
    return storage.getItem(key) === DISMISSED;
  } catch {
    return false;
  }
}

const isRendered = (node: ReactNode) => node != null && node !== false;

/**
 * A page- or site-wide announcement: maintenance, a new feature, an outage, a
 * trial ending. Not an `Alert`, which reports on a region of the page and is
 * live (`status` / `alert`) when inserted; a banner is part of the page from
 * the start, so it is a named `region` (by its title, else the `region`
 * label) and is not announced, unless `urgent`.
 *
 * Tone colours the band (the subtle background, a mark-coloured edge) and
 * leads with the tone's glyph and a hidden tone word, so it never rests on
 * colour. The text block and actions sit on one row when they fit and wrap
 * under each other when they do not; the dismiss button stays at the end.
 * Dismissing hides the banner; with `dismissKey` it stays hidden across reloads.
 * On the server (and its hydration) a remembered dismissal is not yet known,
 * so the banner renders and hides on the client's first pass.
 */
export function Banner({
  tone = "info",
  title,
  icon,
  actions,
  onDismiss,
  dismissKey,
  storage: storageProp,
  placement = "inline",
  sticky = false,
  urgent = false,
  labels: labelsProp,
  classNames,
  className,
  children,
  ...props
}: BannerProps) {
  const labels = useLabels("Banner", DEFAULT_BANNER_LABELS, labelsProp);
  const titleId = useId();
  const storage = storageProp === undefined ? defaultStorage() : storageProp;
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (dismissKey === undefined || typeof window === "undefined") return () => {};
      const onStorage = (event: StorageEvent) => {
        if (event.key === dismissKey || event.key === null) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    [dismissKey],
  );
  const remembered = useSyncExternalStore(
    subscribe,
    () => readDismissed(storage, dismissKey),
    () => false,
  );
  const [dismissedHere, setDismissedHere] = useState(false);
  if (remembered || dismissedHere) return null;

  const dismissible = onDismiss !== undefined || dismissKey !== undefined;
  const dismiss = () => {
    if (dismissKey !== undefined && storage) {
      try {
        storage.setItem(dismissKey, DISMISSED);
      } catch {
        // Not remembered (a full or blocked store); still dismissed for this page.
      }
    }
    setDismissedHere(true);
    onDismiss?.();
  };

  const word = labels.tones[tone];
  const glyph = icon === undefined ? <ToneGlyph tone={tone} /> : icon;
  const named = isRendered(title);
  // A caller's own name wins; a generated aria-labelledby would outrank their aria-label.
  const nameGiven = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
  const autoName = !urgent && !nameGiven;

  return (
    <div
      role={urgent ? "alert" : "region"}
      aria-labelledby={autoName && named ? titleId : undefined}
      aria-label={autoName && !named ? labels.region : undefined}
      data-placement={placement}
      data-print={sticky ? "flow" : undefined}
      className={cn(
        "flex items-start gap-r4 text-body-1 text-fg-primary",
        TONE_SUBTLE_BG[tone],
        TONE_BORDER[tone],
        placement === "top" ? "border-b px-r3 py-r4" : "rounded-md border p-r3",
        sticky && "sticky top-0 z-sticky",
        className,
      )}
      {...props}
    >
      {isRendered(glyph) && (
        // One body-1 line tall, so the glyph centres on the first line of text.
        <span
          aria-hidden
          className={cn("inline-flex h-lh shrink-0 items-center [&>svg]:size-icon", MARK_TEXT[tone], classNames?.icon)}
        >
          {glyph}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-r3 gap-y-r5">
        <div className="flex min-w-0 grow basis-column-sm flex-col gap-r6 [overflow-wrap:anywhere]">
          {word && <span className="sr-only">{word}: </span>}
          {named && (
            <p id={titleId} className={cn("font-semibold", TITLE[tone], classNames?.title)}>
              {title}
            </p>
          )}
          {isRendered(children) && <div className={cn("text-fg-primary", classNames?.body)}>{children}</div>}
        </div>
        {isRendered(actions) && (
          <div
            data-print="hide"
            className={cn("flex min-w-0 max-w-full flex-wrap items-center gap-r5", classNames?.actions)}
          >
            {actions}
          </div>
        )}
      </div>
      {dismissible && (
        <IconButton
          data-print="hide"
          label={labels.dismiss}
          icon={<X />}
          variant="ghost"
          onClick={dismiss}
          // Centred on the first line without setting the banner's height (as Alert's).
          className={cn("-my-r5 -me-r5 text-fg-primary", classNames?.dismiss)}
        />
      )}
    </div>
  );
}
