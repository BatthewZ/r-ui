"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  cloneElement,
  type ComponentPropsWithRef,
  createContext,
  isValidElement,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { preload } from "react-dom";

import { useControllableState } from "../../hooks/use-controllable-state";
import { isRtl } from "../../util/direction";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers, mergeProps } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";
import { Dialog } from "../overlays";
import { IconButton } from "../primitives";
import { Image } from "./Image";

/** One picture in the viewer. */
export interface LightboxItem {
  /** Keys the slide; defaults to its position. */
  id?: string;
  /** The full-size file (a thumbnail elsewhere on the page may be a smaller one). */
  src: string;
  alt: string;
  /** Intrinsic size: the stage reserves the picture's box before it loads. */
  width: number;
  height: number;
  srcSet?: string;
  sizes?: string;
  /** See `Image`: a tiny blurred preview and a fill colour while the picture loads. */
  placeholder?: string;
  placeholderColor?: string;
  /** Shown under the picture, and part of the slide. */
  caption?: ReactNode;
}

/** The viewer's own words. */
export interface LightboxLabels {
  /** The visible counter and each slide's name, 1-based ("3 of 12"). */
  position: (index: number, total: number) => string;
  prev: string;
  next: string;
  close: string;
  /** What a screen reader calls the picture row (`aria-roledescription`). */
  carousel: string;
  /** What a screen reader calls one picture (`aria-roledescription`). */
  slideRole: string;
}

export const DEFAULT_LIGHTBOX_LABELS: Readonly<LightboxLabels> = {
  position: (index, total) => `${index} of ${total}`,
  prev: "Previous image",
  next: "Next image",
  close: "Close",
  carousel: "carousel",
  slideRole: "slide",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Lightbox: LightboxLabels;
  }
}

export type LightboxProps = {
  items: readonly LightboxItem[];
  /** The gallery's name: the dialog's title and accessible name ("Release day photos"). */
  label: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The picture shown, 0-based. Controlled with `onIndexChange`; a `Lightbox.Trigger` sets it as it opens. */
  index?: number;
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  labels?: LabelsProp<LightboxLabels>;
  /** The dialog (the viewer's root element). */
  className?: string;
  classNames?: SlotClassNames<"header" | "title" | "counter" | "stage" | "figure" | "image" | "caption" | "prev" | "next" | "close">;
  /** The page content holding the triggers (thumbnails); rendered as is, before the viewer. */
  children?: ReactNode;
};

interface LightboxContextValue {
  openAt: (index: number, opener: HTMLElement) => void;
}

const LightboxContext = createContext<LightboxContextValue | null>(null);

/** A swipe moves on when it travels this share of the stage's width, at most `SWIPE_MAX` CSS pixels. */
const SWIPE_SHARE = 0.15;
const SWIPE_MAX = 80;

/** Whether the visual viewport is pinch-zoomed: a one-finger move then pans the zoomed page, not the gallery. */
const pinched = () => (window.visualViewport?.scale ?? 1) > 1.01;

/**
 * A modal gallery viewer on the library's `Dialog`: one picture at a time, with
 * previous / next, a counter and captions.
 *
 * - **Opening.** `Lightbox.Trigger index={i}` opens it on picture `i` from any
 *   element (`asChild` puts the behaviour on your own); `open` / `index` control it
 *   from outside. Closing (Escape, the close button) returns focus to the element
 *   that opened it, the originating thumbnail, even after moving through the
 *   gallery.
 * - **Moving.** The buttons, ArrowLeft / ArrowRight (mirrored under `dir="rtl"`),
 *   Home / End, and a horizontal swipe on touch (in reading direction). It stops
 *   at both ends. The counter is a polite live region, so each move is announced
 *   ("4 of 12"); each picture is a group named by its position, with
 *   `aria-roledescription` from `labels`.
 * - **Loading.** The shown picture is an `Image` with `priority`, contained in the
 *   stage, its blur-up placeholder filling the stage until it arrives; its
 *   neighbours are preloaded (`<link rel="preload" as="image">`), so a move rarely
 *   waits.
 * - **Motion.** A new picture fades in over the motion tokens, so reduced motion
 *   shows it at once.
 * - **No zoom of its own.** The stage leaves pinch-zoom to the browser (and stops
 *   reading swipes while the page is zoomed); link to the original file in a
 *   caption where detail matters.
 *
 * `className` is the dialog. `children` (the thumbnails) render before it.
 */
function LightboxRoot({
  items,
  label,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  index: indexProp,
  defaultIndex = 0,
  onIndexChange,
  labels: labelsProp,
  className,
  classNames,
  children,
}: LightboxProps) {
  const labels = useLabels("Lightbox", DEFAULT_LIGHTBOX_LABELS, labelsProp);
  const [openState, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [rawIndex, setIndex] = useControllableState({ value: indexProp, defaultValue: defaultIndex, onChange: onIndexChange });
  const total = items.length;
  const open = openState && total > 0;
  const index = Math.min(Math.max(0, Math.trunc(rawIndex)), Math.max(0, total - 1));
  const item = items[index];

  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const openAt = useCallback(
    (at: number, from: HTMLElement) => {
      opener.current = from;
      setIndex(at);
      setOpen(true);
    },
    [setIndex, setOpen],
  );
  const context = useMemo(() => ({ openAt }), [openAt]);

  // Focus goes home on close. The browser's `<dialog>` restores it to the element
  // focused when it opened, but not every engine focuses a pressed button, so the
  // opener is focused here whenever focus was left on the page or in the closing viewer.
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    if (wasOpen.current && !open) {
      const home = opener.current;
      const active = document.activeElement;
      const stranded = !active || active === document.body || Boolean(dialogRef.current?.contains(active));
      if (home?.isConnected && stranded) home.focus();
      opener.current = null;
    }
    wasOpen.current = open;
  }, [open]);

  // The neighbours, so a move rarely waits for the network.
  useEffect(() => {
    if (!open) return;
    for (const near of [items[index - 1], items[index + 1]]) {
      if (near) preload(near.src, { as: "image", imageSrcSet: near.srcSet, imageSizes: near.sizes, fetchPriority: "low" });
    }
  }, [open, index, items]);

  const go = useCallback((to: number) => setIndex(Math.min(Math.max(0, to), Math.max(0, total - 1))), [setIndex, total]);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    // A text control inside a caption keeps its own arrows.
    if ((event.target as Element).closest("input, textarea, select, [contenteditable]")) return;
    const rtl = isRtl(event.currentTarget);
    if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) go(index + 1);
    else if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) go(index - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(total - 1);
    else return;
    event.preventDefault();
  };

  const swipe = useSwipe((forward) => go(index + (forward ? 1 : -1)));
  const position = labels.position(index + 1, total);

  return (
    <LightboxContext.Provider value={context}>
      {children}
      {total > 0 && (
        <Dialog open={open} onOpenChange={setOpen}>
          <CaptureOpener open={open} opener={opener} />
          <Dialog.Content
            ref={dialogRef}
            showClose={false}
            onKeyDown={onKeyDown}
            className={cn("r-media-lightbox gap-r4 p-r3", className)}
          >
            <div className={cn("flex min-w-0 items-center gap-r3", classNames?.header)}>
              <Dialog.Title title={label} className={cn("min-w-0 flex-1 truncate text-h5", classNames?.title)}>
                {label}
              </Dialog.Title>
              <p aria-live="polite" aria-atomic data-lightbox="counter" className={cn("shrink-0 text-body-2 text-fg-muted", classNames?.counter)}>
                {position}
              </p>
              <Dialog.Close asChild>
                <IconButton label={labels.close} icon={<X />} autoFocus data-lightbox="close" className={classNames?.close} />
              </Dialog.Close>
            </div>
            <div
              role="group"
              aria-roledescription={labels.carousel}
              aria-label={label}
              data-pinched={swipe.pinched || undefined}
              className={cn("r-media-lightbox-stage relative flex min-h-0 flex-1 flex-col", classNames?.stage)}
              {...swipe.handlers}
            >
              {item && (
                <figure
                  key={item.id ?? index}
                  role="group"
                  aria-roledescription={labels.slideRole}
                  aria-label={position}
                  data-index={index}
                  className={cn("flex min-h-0 flex-1 animate-fade-in flex-col gap-r4", classNames?.figure)}
                >
                  <div className="relative min-h-0 flex-1">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      width={item.width}
                      height={item.height}
                      srcSet={item.srcSet}
                      sizes={item.sizes}
                      placeholder={item.placeholder}
                      placeholderColor={item.placeholderColor}
                      ratio="fill"
                      fit="contain"
                      radius="md"
                      priority
                      className={cn("absolute inset-0", classNames?.image)}
                    />
                  </div>
                  {item.caption && (
                    <figcaption
                      className={cn("min-w-0 shrink-0 break-words text-center text-body-2 text-fg-secondary", classNames?.caption)}
                    >
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              )}
              {/* After the slide: positioned, the picture paints over anything positioned before it. */}
              {total > 1 && (
                <>
                  <IconButton
                    variant="secondary"
                    label={labels.prev}
                    icon={<ChevronLeft className="rtl:-scale-x-100" />}
                    aria-disabled={index === 0 || undefined}
                    data-lightbox="prev"
                    onClick={() => go(index - 1)}
                    className={cn("absolute start-r3 top-1/2 -translate-y-1/2", classNames?.prev)}
                  />
                  <IconButton
                    variant="secondary"
                    label={labels.next}
                    icon={<ChevronRight className="rtl:-scale-x-100" />}
                    aria-disabled={index === total - 1 || undefined}
                    data-lightbox="next"
                    onClick={() => go(index + 1)}
                    className={cn("absolute end-r3 top-1/2 -translate-y-1/2", classNames?.next)}
                  />
                </>
              )}
            </div>
          </Dialog.Content>
        </Dialog>
      )}
    </LightboxContext.Provider>
  );
}

/**
 * Records what had focus when the viewer opened from outside a trigger (a
 * controlled `open`). It renders before `Dialog.Content`, so its layout effect
 * runs before the dialog's `showModal()` moves focus in.
 */
function CaptureOpener({ open, opener }: { open: boolean; opener: RefObject<HTMLElement | null> }) {
  useLayoutEffect(() => {
    if (!open || opener.current) return;
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }, [open, opener]);
  return null;
}

/**
 * A horizontal swipe by touch or pen on the stage: `onSwipe(true)` for a move
 * against reading direction (leftward in LTR, the next picture). The stage
 * leaves vertical panning and pinch-zoom to the browser (`touch-action` in
 * styles.css), so only horizontal moves arrive here. A mouse drag is not a swipe.
 */
function useSwipe(onSwipe: (forward: boolean) => void) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const [isPinched, setPinched] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const read = () => setPinched(pinched());
    viewport.addEventListener("resize", read);
    return () => viewport.removeEventListener("resize", read);
  }, []);

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "mouse" || !event.isPrimary || pinched()) return;
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const from = start.current;
      start.current = null;
      if (!from || from.id !== event.pointerId) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      const min = Math.min(event.currentTarget.clientWidth * SWIPE_SHARE, SWIPE_MAX);
      if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      onSwipe(dx < 0 !== isRtl(event.currentTarget));
    },
    onPointerCancel() {
      start.current = null;
    },
  };
  return { handlers, pinched: isPinched };
}

export type LightboxTriggerProps = {
  /** The picture to open on, 0-based. */
  index: number;
  /** Put the open behaviour on your own single child instead of a `<button>`. */
  asChild?: boolean;
} & ComponentPropsWithRef<"button">;

/**
 * Opens the viewer on picture `index`. By default a bare `<button>` the width of
 * its container, for a thumbnail inside it (an `Image`, whose `alt` names the
 * button): a zoom cursor, a quiet wash on hover, the contract's focus ring.
 *
 * With `asChild` on a link to the full file (`<a href="/photos/1.jpg">`) the page
 * works without script; with it, a plain click opens the viewer instead of
 * following the link, and a modified or middle click still opens the file.
 */
function LightboxTrigger({ index, asChild = false, onClick, className, children, ...props }: LightboxTriggerProps) {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("Lightbox.Trigger must be used inside <Lightbox>");
  const { openAt } = ctx;
  const own = {
    ...props,
    "aria-haspopup": "dialog" as const,
    onClick: composeEventHandlers(onClick, (event: MouseEvent<HTMLElement>) => {
      // A link to the file (asChild) still opens it in a new tab or window by the browser's own gestures.
      const link = event.currentTarget instanceof HTMLAnchorElement && event.currentTarget.hasAttribute("href");
      if (link && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
      event.preventDefault();
      openAt(index, event.currentTarget);
    }),
  };
  if (asChild) {
    if (!isValidElement(children)) return null;
    const child = children as ReactElement<Record<string, unknown>>;
    const props: Record<string, unknown> = { ...own, className };
    return cloneElement(child, mergeProps(child.props, props));
  }
  return (
    <button
      type="button"
      {...own}
      className={cn("r-media-lightbox-trigger relative block w-full cursor-zoom-in rounded-md text-start", className)}
    >
      {children}
    </button>
  );
}

/** `Lightbox`, plus `Lightbox.Trigger`. */
export const Lightbox = Object.assign(LightboxRoot, { Trigger: LightboxTrigger });
