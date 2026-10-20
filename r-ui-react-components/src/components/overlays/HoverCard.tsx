"use client";
import { Eye } from "lucide-react";
import {
  cloneElement,
  type ComponentPropsWithRef,
  createContext,
  type FocusEvent,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import {
  type Placement,
  safePolygon,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
} from "../../hooks/use-floating";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers, mergeProps } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { IconButton, type IconButtonProps } from "../primitives";
import { onEscape, type OpenStateProps, topLayerExit, useExitPresence, usePartId, useRegisteredId } from "./internal";

export interface HoverCardLabels {
  /** The touch (and keyboard) toggle's name, when the caller gives it none. */
  toggle: string;
}

export const DEFAULT_HOVER_CARD_LABELS: HoverCardLabels = { toggle: "Show preview" };

declare module "../../util/locale" {
  interface LabelsRegistry {
    HoverCard: HoverCardLabels;
  }
}

type Floating = ReturnType<typeof useFloating>;
type Interactions = ReturnType<typeof useInteractions>;

interface HoverCardContextValue {
  open: boolean;
  present: boolean;
  floating: Floating;
  getReferenceProps: Interactions["getReferenceProps"];
  getFloatingProps: Interactions["getFloatingProps"];
  cardRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  toggleRef: RefObject<HTMLButtonElement | null>;
  contentId: string;
  triggerId: string | undefined;
  registerTrigger: (id: string | undefined) => void;
  labels: HoverCardLabels;
  /** Open after the delay, for keyboard focus on the trigger. */
  focusOpen: (event: FocusEvent) => void;
  /** Close once focus has left the trigger, the toggle and the card, unless the pointer still holds it. */
  focusLeave: (event: FocusEvent) => void;
  /** Close; focus inside the card goes back to the trigger first. */
  close: () => void;
  toggle: (event: MouseEvent) => void;
}

const HoverCardContext = createContext<HoverCardContextValue | null>(null);

function useHoverCard(part: string) {
  const ctx = useContext(HoverCardContext);
  if (!ctx) throw new Error(`HoverCard.${part} must be used inside <HoverCard>`);
  return ctx;
}

const contains = (ref: RefObject<Element | null>, node: Node | null) => Boolean(node && ref.current?.contains(node));
const hovered = (ref: RefObject<Element | null>) => {
  try {
    return Boolean(ref.current?.matches(":hover"));
  } catch {
    return false;
  }
};
/** Keyboard focus, not a press: a tap or click on the trigger is navigation, never a preview. */
const focusVisible = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

export interface HoverCardProps extends OpenStateProps {
  /** Wait before opening, on hover and on keyboard focus, in ms. @default 500 */
  openDelay?: number;
  /** Wait before closing once the pointer leaves, in ms; the pointer can cross onto the card meanwhile. @default 300 */
  closeDelay?: number;
  /** @default "bottom" */
  placement?: Placement;
  /** Suppress the card without unwrapping the trigger. */
  disabled?: boolean;
  labels?: LabelsProp<HoverCardLabels>;
  children: ReactNode;
}

/**
 * A rich, non-modal preview of what a link or button leads to (a user, a
 * repository), opened by hovering or keyboard-focusing the trigger.
 *
 * - Supplementary by contract: the trigger keeps its own action (a link still
 *   navigates on click), and whatever the card shows is reachable at the
 *   destination. Never put the only copy of something in it.
 * - Opens after `openDelay` on mouse hover and on keyboard focus
 *   (`:focus-visible`); a tap, a click or a touch hover never opens it. It
 *   stays open while the pointer is on the trigger or the card, and the pointer
 *   can cross the gap between them (a safe polygon).
 * - Escape closes it wherever focus is, as a tooltip does (WCAG 1.4.13), and
 *   only it: an enclosing popover or dialog stays open.
 * - Focus (the disclosure model): the card renders in place, right after the
 *   trigger, so Tab from the trigger walks into its links and buttons and on
 *   out the other side; Shift+Tab walks back. Opening never moves focus. While
 *   focus is inside, moving the pointer away does not close it; focus leaving
 *   the trigger and the card does, and closing from inside hands focus back to
 *   the trigger first. The card is a `role="group"` named by the trigger.
 * - Touch: a long press belongs to the platform's own link menu, so it is left
 *   alone. Place a `HoverCard.Toggle` beside the trigger for touch (and anyone
 *   else): a press opens the card and it stays until pressed again, a press
 *   outside, or Escape.
 * - Rendered in place and promoted to the top layer (density and direction
 *   follow where it is written, no ancestor clips it), capped by the shared
 *   surface width, fading in and out.
 *
 * The card is a `div`: in running text, hold the trigger in a `div`, not a `p`.
 */
function HoverCardRoot({
  openDelay = 500,
  closeDelay = 300,
  placement = "bottom",
  disabled = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  labels: labelsProp,
  children,
}: HoverCardProps) {
  const labels = useLabels("HoverCard", DEFAULT_HOVER_CARD_LABELS, labelsProp);
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const shown = open && !disabled;
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const contentId = useId();
  const [triggerId, registerTrigger] = useRegisteredId();
  const present = useExitPresence(shown, cardRef, topLayerExit);

  /** Every close comes through here: focus inside the card goes home before the card turns inert. */
  const requestOpen = (next: boolean) => {
    if (!next && contains(cardRef, cardRef.current?.ownerDocument.activeElement ?? null)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    setOpen(next);
  };

  const floating = useFloating({
    placement,
    // Positioned and promoted for as long as it is on screen, exit included.
    open: present,
    onOpenChange: (next: boolean, _event?: Event, reason?: string) => {
      // The pointer wandering off does not take the card from under keyboard focus.
      const byPointer = reason === "hover" || reason === "safe-polygon";
      if (!next && byPointer && contains(cardRef, cardRef.current?.ownerDocument.activeElement ?? null)) return;
      requestOpen(next);
    },
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    // `mouseOnly`: a touch "hover" is a tap, and a tap belongs to the trigger.
    useHover(floating.context, {
      enabled: !disabled,
      mouseOnly: true,
      delay: { open: openDelay, close: closeDelay },
      handleClose: safePolygon(),
    }),
    // Escape is handled on the elements and the document (below). A press on
    // the toggle is its own toggle, not a press outside.
    useDismiss(floating.context, {
      enabled: !disabled,
      escapeKey: false,
      outsidePress: (event) => !contains(toggleRef, event.target as Node | null),
    }),
  ]);

  // Focus opens after the same delay as hover, so tabbing past a trigger never flashes a card.
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearFocusTimer = () => clearTimeout(focusTimer.current);
  useEffect(() => clearFocusTimer, []);

  const focusOpen = (event: FocusEvent) => {
    clearFocusTimer();
    // `shown` also covers the focus a closing card hands back: it moves before the close commits.
    if (disabled || shown || !focusVisible(event.currentTarget)) return;
    const native = event.nativeEvent;
    focusTimer.current = setTimeout(() => floating.context.onOpenChange(true, native, "focus"), openDelay);
  };
  const focusLeave = (event: FocusEvent) => {
    clearFocusTimer();
    const next = event.relatedTarget as Node | null;
    if (contains(triggerRef, next) || contains(cardRef, next) || contains(toggleRef, next)) return;
    if (!shown || hovered(triggerRef) || hovered(cardRef)) return;
    setOpen(false);
  };

  // Escape while it is shown and focus is elsewhere (it opened on hover). On
  // `document`, so every surface's own handler ran first: one that used the key
  // prevented it, and this stands down.
  useEffect(() => {
    if (!shown) return;
    const doc = cardRef.current?.ownerDocument ?? document;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
    };
    doc.addEventListener("keydown", onKeyDown);
    return () => doc.removeEventListener("keydown", onKeyDown);
  }, [shown, setOpen]);

  const value: HoverCardContextValue = {
    open: shown,
    present,
    floating,
    getReferenceProps,
    getFloatingProps,
    cardRef,
    triggerRef,
    toggleRef,
    contentId,
    triggerId,
    registerTrigger,
    labels,
    focusOpen,
    focusLeave,
    close: () => requestOpen(false),
    // Through floating-ui with the click, so its hover logic leaves a pressed-open card alone.
    toggle: (event) => {
      clearFocusTimer();
      if (disabled) return;
      floating.context.onOpenChange(!shown, event.nativeEvent, "click");
    },
  };
  return <HoverCardContext value={value}>{children}</HoverCardContext>;
}

export interface HoverCardTriggerProps {
  /** One element with an action of its own (a link, a button). It receives the ref and the handlers. */
  children: ReactElement;
}

/** Wires the caller's link or button: hover and keyboard focus open the card; its own click is untouched. */
function HoverCardTrigger({ children }: HoverCardTriggerProps) {
  const ctx = useHoverCard("Trigger");
  const child = isValidElement(children) ? (children as ReactElement<Record<string, unknown>>) : null;
  // The child's own id if it has one (its IDREFs keep working), else a generated one; the card is named by it.
  const ownId = usePartId(child?.props.id as string | undefined, ctx.registerTrigger);
  if (!child) return children;
  return cloneElement(
    child,
    mergeProps(
      child.props,
      ctx.getReferenceProps({
        ref: mergeRefs(ctx.triggerRef, ctx.floating.refs.setReference),
        id: ownId,
        onFocus: ctx.focusOpen,
        onBlur: ctx.focusLeave,
        // Only while open: a closed card's Escape belongs to whatever encloses it.
        onKeyDown: ctx.open ? onEscape(ctx.close) : undefined,
      }) as Record<string, unknown>
    )
  );
}

export type HoverCardToggleProps = Omit<IconButtonProps, "label" | "icon"> & {
  /** Default: `labels.toggle`. Name what it previews ("Preview @ada"). */
  label?: string;
  /** Default: an eye. */
  icon?: ReactNode;
};

/**
 * Opens and closes the card with a press: the way in for touch, where hover
 * does not exist and a long press is the platform's link menu, and a plain
 * disclosure button for everyone else. Place it right after the trigger.
 */
function HoverCardToggle({ label, icon, onClick, onBlur, onKeyDown, ref, ...props }: HoverCardToggleProps) {
  const ctx = useHoverCard("Toggle");
  return (
    <IconButton
      data-print="hide"
      {...props}
      ref={mergeRefs(ref, ctx.toggleRef)}
      label={label ?? ctx.labels.toggle}
      icon={icon ?? <Eye className="size-icon" />}
      aria-expanded={ctx.open}
      aria-controls={ctx.open ? ctx.contentId : undefined}
      onClick={composeEventHandlers(onClick, ctx.toggle)}
      onBlur={composeEventHandlers(onBlur, ctx.focusLeave)}
      onKeyDown={ctx.open ? composeEventHandlers(onKeyDown, onEscape(ctx.close)) : onKeyDown}
    />
  );
}

export type HoverCardContentProps = ComponentPropsWithRef<"div">;

/**
 * The card. Its width is a column (`--COLUMN-LG`) under the shared surface cap,
 * so it never reaches the viewport's edges. Named by the trigger unless you
 * name it (`aria-label`, `aria-labelledby`).
 */
function HoverCardContent({ className, style, ref, onKeyDown, onBlur, children, ...props }: HoverCardContentProps) {
  const ctx = useHoverCard("Content");
  if (!ctx.present) return null;
  return (
    <div
      {...ctx.getFloatingProps({
        ...props,
        onKeyDown: composeEventHandlers(onKeyDown, onEscape(ctx.close)),
        onBlur: composeEventHandlers(onBlur, ctx.focusLeave),
      })}
      ref={mergeRefs(ref, ctx.cardRef, ctx.floating.refs.setFloating)}
      id={ctx.contentId}
      role="group"
      aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : ctx.triggerId)}
      // Leaving: on screen for its exit, but no longer interactive.
      inert={!ctx.open}
      style={{ ...ctx.floating.floatingStyles, ...style }}
      className={cn(
        // `whitespace-normal text-start`: a trigger in a one-line or end-aligned table cell must not pass those on.
        "r-overlays-surface w-column-lg rounded-md border border-border bg-surface-0 p-r3 text-start text-body-1 whitespace-normal text-fg-primary shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}

export const HoverCard = Object.assign(HoverCardRoot, {
  Trigger: HoverCardTrigger,
  Toggle: HoverCardToggle,
  Content: HoverCardContent,
});
