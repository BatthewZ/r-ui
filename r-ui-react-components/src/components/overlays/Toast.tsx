"use client";
import { X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { MARK_TEXT, type Tone, TONE_LABELS, ToneGlyph } from "../../util/tone";
import { Button, IconButton } from "../primitives";
import { afterExit } from "./internal";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  /** `error` and `serious` interrupt (the assertive region) and stay until dismissed. @default "neutral" */
  tone?: Tone;
  /** One follow-up action. It is not the only route to it: the toast leaves. */
  action?: { label: string; onClick: () => void };
  /**
   * Milliseconds before it dismisses itself; `0` keeps it until dismissed.
   * The clock stops while the pointer or focus is on the stack.
   * @default the provider's `duration`; `0` for `error`, `serious` and a toast with an action
   */
  duration?: number;
  /** Re-using an id replaces that toast in place. */
  id?: string;
}

export interface ToastApi {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

interface ToastEntry extends ToastOptions {
  id: string;
  tone: Tone;
  duration: number;
  leaving: boolean;
}

const ToastContext = createContext<ToastApi | null>(null);

/** The toast API of the nearest `ToastProvider`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export type ToastPosition = "top-start" | "top-end" | "bottom-start" | "bottom-end";

/** The stack's own words. */
export interface ToastLabels {
  /** The landmark's accessible name. */
  region: string;
  /** Each toast's dismiss button. */
  dismiss: string;
  /** Spoken before the title, per tone (`""` says nothing: the default for `neutral`). */
  tones: Readonly<Record<Tone, string>>;
}

export const DEFAULT_TOAST_LABELS: Readonly<ToastLabels> = {
  region: "Notifications",
  dismiss: "Dismiss",
  tones: TONE_LABELS,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Toast: ToastLabels;
  }
}

/** Interrupts: announced assertively and kept until dismissed. */
const isUrgent = (tone: Tone) => tone === "error" || tone === "serious";

export interface ToastProviderProps {
  children: ReactNode;
  /** Corner of the viewport, in logical terms (`end` is the right in LTR). @default "bottom-end" */
  position?: ToastPosition;
  /** Default auto-dismiss time in ms. @default 6000 */
  duration?: number;
  /** Most toasts on screen; the oldest leaves first. @default 4 */
  max?: number;
  /** Translations; `tones` merges per tone over `DEFAULT_TOAST_LABELS.tones`. */
  labels?: LabelsProp<ToastLabels>;
  className?: string;
  classNames?: SlotClassNames<"toast" | "title" | "description" | "action">;
}

let sequence = 0;

/** A toast's `<li>` in the stack, by id. */
const toastSelector = (id: string) => `li[data-toast-id="${CSS.escape(id)}"]`;

/**
 * Hosts the toast stack and provides `useToast()`.
 *
 * The stack is two always-mounted live regions (a toast must arrive *into* an
 * existing region to be announced): `error` and `serious` go to the assertive
 * one, everything else to the polite one. It is promoted to the top layer, so it paints over
 * modals opened before it. Unlike every other floating surface here it is not
 * anchored to anything, so it renders where the provider is. A bottom stack
 * sits `--r-navigation-shell-bottom-inset` higher (an AppShell's shown bottom nav
 * publishes it on `:root`), so it never covers that nav.
 *
 * A toast that leaves while focus is in it (its own Dismiss or action, or
 * `dismiss(id)`) hands focus to the next toast's Dismiss, else back to where
 * focus was before it entered the stack, so focus never drops to `<body>`.
 *
 * Known limit: while a modal `<dialog>` is open, everything outside it is inert,
 * so a toast raised then is visible but neither clickable nor announced. Keep
 * what a toast says somewhere the reader can get back to.
 */
export function ToastProvider({
  children,
  position = "bottom-end",
  duration = 6000,
  max = 4,
  labels,
  className,
  classNames,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const regionRef = useRef<HTMLElement>(null);
  /** Where focus was before it entered the stack. */
  const returnFocus = useRef<HTMLElement | null>(null);
  const text = useLabels("Toast", DEFAULT_TOAST_LABELS, labels);

  /**
   * Before toasts leave: if focus is in one of them, move it to the next
   * remaining toast's Dismiss, else back where it came from. Done first, while
   * the focused node is still there: a removed or inert node fires no blur in
   * every engine, and focus would fall to `<body>`.
   */
  const handOffFocus = useCallback((leaving: (id: string) => boolean) => {
    const region = regionRef.current;
    const active = document.activeElement;
    if (!region || !(active instanceof HTMLElement) || !region.contains(active)) return;
    const current = active.closest<HTMLElement>("li[data-toast-id]");
    if (!current || !leaving(current.dataset.toastId ?? "")) return;
    const items = [...region.querySelectorAll<HTMLElement>("li[data-toast-id]:not([data-leaving])")];
    const at = items.indexOf(current);
    const stays = (item: HTMLElement | undefined) => item && !leaving(item.dataset.toastId ?? "");
    const next = items.slice(at + 1).find(stays) ?? items.slice(0, at).reverse().find(stays);
    const target = next?.querySelector<HTMLElement>("[data-toast-dismiss]") ?? returnFocus.current;
    if (target?.isConnected) target.focus();
    else active.blur();
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      handOffFocus((other) => other === id);
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    },
    [handOffFocus]
  );
  const remove = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const dismissAll = useCallback(() => {
    handOffFocus(() => true);
    setToasts((prev) => prev.map((t) => ({ ...t, leaving: true })));
  }, [handOffFocus]);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? `toast-${++sequence}`;
      const tone = options.tone ?? "neutral";
      const sticky = isUrgent(tone) || options.action !== undefined;
      const entry: ToastEntry = {
        ...options,
        id,
        tone,
        duration: options.duration ?? (sticky ? 0 : duration),
        leaving: false,
      };
      setToasts((prev) => {
        const next = prev.some((t) => t.id === id) ? prev.map((t) => (t.id === id ? entry : t)) : [...prev, entry];
        const live = next.filter((t) => !t.leaving);
        const excess = new Set(live.slice(0, Math.max(0, live.length - max)).map((t) => t.id));
        return excess.size ? next.map((t) => (excess.has(t.id) ? { ...t, leaving: true } : t)) : next;
      });
      return id;
    },
    [duration, max]
  );

  const api = useMemo(() => ({ toast, dismiss, dismissAll }), [toast, dismiss, dismissAll]);

  // Promote the stack to the top layer, and re-promote it when a toast arrives
  // so it lands above a dialog opened since (top-layer order is insertion order).
  // Never while focus is inside it: hiding would throw that focus away.
  // Without `popover` support the region stays a fixed box in the page.
  const count = toasts.length;
  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region || typeof region.showPopover !== "function") return;
    // `manual`: dismissal is ours; the platform's light dismiss never runs.
    region.setAttribute("popover", "manual");
    if (region.matches(":popover-open")) {
      if (count === 0 || region.contains(document.activeElement)) return;
      region.hidePopover();
    }
    region.showPopover();
  }, [count]);

  // Focus is read from the document, not only from focus events: a toast
  // removed with focus inside it (the oldest pushed out by `max`) takes the
  // focus away without a blur, which would leave every later clock stopped.
  useEffect(() => {
    setFocused(regionRef.current?.contains(document.activeElement) ?? false);
  }, [toasts]);

  const paused = hovered || focused;
  const top = position.startsWith("top");
  // Newest nearest the corner's edge: at the bottom for a bottom stack.
  const ordered = top ? [...toasts].reverse() : toasts;
  const list = (tone: "assertive" | "polite") =>
    ordered
      .filter((t) => isUrgent(t.tone) === (tone === "assertive"))
      .map((t) => (
        <ToastItem
          key={t.id}
          entry={t}
          paused={paused}
          dismissLabel={text.dismiss}
          toneLabel={text.tones[t.tone]}
          classNames={classNames}
          onDismiss={dismiss}
          onRemove={remove}
        />
      ));
  const assertive = list("assertive");
  const polite = list("polite");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        ref={regionRef}
        aria-label={text.region}
        data-position={position}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={(event) => {
          // Arriving from outside: remember where from, to hand focus back.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            returnFocus.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
          }
          setFocused(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        className={cn("r-overlays-toast-region flex flex-col", className)}
      >
        {/* Errors interrupt; the rest wait their turn. Both lists stay mounted:
            a region created with its message already inside is not announced. */}
        <ol aria-live="assertive" className="flex flex-col">
          {assertive}
        </ol>
        <ol aria-live="polite" className={cn("flex flex-col", assertive.length > 0 && polite.length > 0 && "mt-r4")}>
          {polite}
        </ol>
      </section>
    </ToastContext.Provider>
  );
}

interface ToastItemProps {
  entry: ToastEntry;
  paused: boolean;
  dismissLabel: string;
  toneLabel: string;
  classNames: ToastProviderProps["classNames"];
  onDismiss: (id: string) => void;
  onRemove: (id: string) => void;
}

function ToastItem({ entry, paused, dismissLabel, toneLabel, classNames, onDismiss, onRemove }: ToastItemProps) {
  const { id, title, description, tone, action, duration, leaving } = entry;
  const ref = useRef<HTMLLIElement>(null);
  const clock = useRef({ entry, remaining: duration });

  // Auto-dismiss on a clock that stops while paused and resumes with what was
  // left. A toast replaced in place (same id) starts a fresh clock.
  useEffect(() => {
    if (clock.current.entry !== entry) clock.current = { entry, remaining: entry.duration };
    if (entry.duration <= 0 || paused || entry.leaving) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(entry.id), clock.current.remaining);
    return () => {
      clearTimeout(timer);
      clock.current.remaining -= Date.now() - started;
    };
  }, [entry, paused, onDismiss]);

  // Leaving: play the exit (the slot's collapse ends it), then unmount (at once when nothing animates).
  useEffect(() => {
    const el = ref.current;
    if (!leaving || !el) return;
    return afterExit(el, () => onRemove(id));
  }, [leaving, id, onRemove]);

  // Neutral carries no glyph: a plain notice needs no state mark.
  const icon = tone === "neutral" ? null : <ToneGlyph tone={tone} className={MARK_TEXT[tone]} />;
  return (
    <li
      ref={ref}
      data-toast-id={id}
      data-tone={tone}
      data-leaving={leaving || undefined}
      // Leaving: on screen for its exit, but no longer interactive.
      inert={leaving}
      className="r-overlays-toast-slot"
    >
      {/* The slot's row collapses once the toast has slid out, so its neighbours glide into the gap. */}
      <div className="min-h-0">
        <div
          className={cn(
            "r-overlays-toast pointer-events-auto flex items-start gap-r4 rounded-md border border-border bg-surface-0 p-r3 text-body-1 text-fg-primary shadow-md",
            classNames?.toast
          )}
        >
          {icon && (
            <span aria-hidden className="flex h-[1lh] shrink-0 items-center [&>svg]:size-icon">
              {icon}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-r6">
            <p className={cn("font-medium", classNames?.title)}>
              {toneLabel && <span className="sr-only">{toneLabel}: </span>}
              {title}
            </p>
            {description && <p className={cn("text-fg-secondary", classNames?.description)}>{description}</p>}
            {action && (
              <div className="pt-r5">
                <Button
                  variant="secondary"
                  className={classNames?.action}
                  onClick={() => {
                    action.onClick();
                    onDismiss(id);
                  }}
                >
                  {action.label}
                </Button>
              </div>
            )}
          </div>
          <IconButton
            data-toast-dismiss=""
            label={dismissLabel}
            icon={<X />}
            variant="ghost"
            className="-me-r5 -mt-r5 shrink-0"
            onClick={() => onDismiss(id)}
          />
        </div>
      </div>
    </li>
  );
}
