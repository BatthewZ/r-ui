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

import { cn, type SlotClassNames } from "../../util/style";
import { MARK_TEXT, ToneGlyph } from "../../util/tone";
import { Button, IconButton } from "../primitives";

export type ToastTone = "neutral" | "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  /** @default "neutral" */
  tone?: ToastTone;
  /** One follow-up action. It is not the only route to it: the toast leaves. */
  action?: { label: string; onClick: () => void };
  /**
   * Milliseconds before it dismisses itself; `0` keeps it until dismissed.
   * The clock stops while the pointer or focus is on the stack.
   * @default the provider's `duration`; `0` for `error` and for a toast with an action
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
  tone: ToastTone;
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

export interface ToastProviderProps {
  children: ReactNode;
  /** Corner of the viewport, in logical terms (`end` is the right in LTR). @default "bottom-end" */
  position?: ToastPosition;
  /** Default auto-dismiss time in ms. @default 6000 */
  duration?: number;
  /** Most toasts on screen; the oldest leaves first. @default 4 */
  max?: number;
  /** The landmark's accessible name. @default "Notifications" */
  label?: string;
  /** The dismiss button's accessible name. @default "Dismiss" */
  dismissLabel?: string;
  /** Visually hidden word read before the title, per tone. */
  toneLabels?: Partial<Record<ToastTone, string>>;
  className?: string;
  classNames?: SlotClassNames<"toast" | "title" | "description" | "action">;
}

const TONE_LABEL: Record<ToastTone, string> = {
  neutral: "",
  success: "Success:",
  error: "Error:",
  warning: "Warning:",
  info: "Info:",
};


let sequence = 0;

/**
 * Hosts the toast stack and provides `useToast()`.
 *
 * The stack is two always-mounted live regions (a toast must arrive *into* an
 * existing region to be announced): errors go to the assertive one, everything
 * else to the polite one. It is promoted to the top layer, so it paints over
 * modals opened before it. Unlike every other floating surface here it is not
 * anchored to anything, so it renders where the provider is.
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
  label = "Notifications",
  dismissLabel = "Dismiss",
  toneLabels,
  className,
  classNames,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const regionRef = useRef<HTMLElement>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  }, []);
  const remove = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const dismissAll = useCallback(() => setToasts((prev) => prev.map((t) => ({ ...t, leaving: true }))), []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = options.id ?? `toast-${++sequence}`;
      const tone = options.tone ?? "neutral";
      const sticky = tone === "error" || options.action !== undefined;
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

  const paused = hovered || focused;
  const top = position.startsWith("top");
  // Newest nearest the corner's edge: at the bottom for a bottom stack.
  const ordered = top ? [...toasts].reverse() : toasts;
  const list = (tone: "assertive" | "polite") =>
    ordered
      .filter((t) => (t.tone === "error") === (tone === "assertive"))
      .map((t) => (
        <ToastItem
          key={t.id}
          entry={t}
          paused={paused}
          dismissLabel={dismissLabel}
          toneLabel={toneLabels?.[t.tone] ?? TONE_LABEL[t.tone]}
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
        aria-label={label}
        data-position={position}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        className={cn("r-overlays-toast-region flex flex-col", className)}
      >
        {/* Errors interrupt; the rest wait their turn. Both lists stay mounted:
            a region created with its message already inside is not announced. */}
        <ol aria-live="assertive" className="flex flex-col gap-r4">
          {assertive}
        </ol>
        <ol aria-live="polite" className={cn("flex flex-col gap-r4", assertive.length > 0 && polite.length > 0 && "mt-r4")}>
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

  // Leaving: play the exit, then unmount. Nothing to wait for when no animation
  // runs (reduced motion collapses it to ~0; an engine without CSS has none).
  useEffect(() => {
    const el = ref.current;
    if (!leaving || !el) return;
    const seconds = Number.parseFloat(getComputedStyle(el).animationDuration);
    if (!(seconds > 0.001)) {
      onRemove(id);
      return;
    }
    const timer = setTimeout(() => onRemove(id), seconds * 1000 + 50);
    return () => clearTimeout(timer);
  }, [leaving, id, onRemove]);

  // Neutral carries no glyph: a plain notice needs no state mark.
  const icon = tone === "neutral" ? null : <ToneGlyph tone={tone} className={MARK_TEXT[tone]} />;
  return (
    <li
      ref={ref}
      data-tone={tone}
      className={cn(
        "pointer-events-auto flex items-start gap-r4 rounded-md border border-border bg-surface-0 p-r3 text-body-1 text-fg-primary shadow-md",
        leaving ? "animate-fade-out" : "animate-fade-up",
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
          {toneLabel && <span className="sr-only">{toneLabel} </span>}
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
        label={dismissLabel}
        icon={<X />}
        variant="ghost"
        className="-me-r5 -mt-r5 shrink-0"
        onClick={() => onDismiss(id)}
      />
    </li>
  );
}
