"use client";
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useId,
  useMemo,
  useRef,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import {
  FloatingFocusManager,
  floatingArrowProps,
  type Placement,
  useDismiss,
  useFloating,
  useInteractions,
} from "../../hooks/use-floating";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import type { ButtonProps } from "../primitives";
import { ButtonOrSlot, onEscape, type OpenStateProps, topLayerExit, useExitPresence, usePartId, useRegisteredId } from "./internal";

type Floating = ReturnType<typeof useFloating>;
type Interactions = ReturnType<typeof useInteractions>;

interface PopoverContextValue {
  open: boolean;
  /** Open, or still running its exit transition. */
  present: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  setOpen: (open: boolean) => void;
  contentId: string;
  /** The id the trigger rendered (the caller's or a generated one), which names the panel. */
  triggerId: string | undefined;
  registerTrigger: (id: string | undefined) => void;
  floating: Floating;
  arrowRef: RefObject<HTMLDivElement | null>;
  getReferenceProps: Interactions["getReferenceProps"];
  getFloatingProps: Interactions["getFloatingProps"];
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopover(part: string) {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error(`Popover.${part} must be used inside <Popover>`);
  return ctx;
}

export interface PopoverProps extends OpenStateProps {
  /** @default "bottom" */
  placement?: Placement;
  children: ReactNode;
}

function PopoverRoot({ open: openProp, defaultOpen = false, onOpenChange, placement = "bottom", children }: PopoverProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const contentId = useId();
  const [triggerId, registerTrigger] = useRegisteredId();
  const arrowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const present = useExitPresence(open, panelRef, topLayerExit);
  // Positioned and promoted for as long as it is on screen, exit included.
  const floating = useFloating({ placement, arrowRef, open: present, onOpenChange: setOpen });

  // No `useClick`: it toggles from floating-ui's `open`, which stays true through
  // the exit, so a press on the trigger mid-exit would close instead of reopen.
  // The trigger toggles from our own state instead.
  const { getReferenceProps, getFloatingProps } = useInteractions([
    // Light dismiss from the pointer. Escape is handled on the elements
    // (`onEscape`) so a nested surface closes first and alone.
    useDismiss(floating.context, { escapeKey: false }),
  ]);

  const value = useMemo(
    () => ({
      open,
      present,
      panelRef,
      setOpen,
      contentId,
      triggerId,
      registerTrigger,
      floating,
      arrowRef,
      getReferenceProps,
      getFloatingProps,
    }),
    [open, present, setOpen, contentId, triggerId, registerTrigger, floating, getReferenceProps, getFloatingProps]
  );
  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export type PopoverTriggerProps = ButtonProps & {
  /** Put the trigger behaviour on your own single child instead of a `Button`. */
  asChild?: boolean;
};

function PopoverTrigger({ asChild = false, children, onClick, id, ...props }: PopoverTriggerProps) {
  const { open, setOpen, contentId, registerTrigger, floating, getReferenceProps } = usePopover("Trigger");
  const ownId = usePartId(id, registerTrigger);
  const triggerProps = getReferenceProps({
    ...props,
    id: ownId,
    ref: mergeRefs(props.ref, floating.refs.setReference),
    onClick: composeEventHandlers(onClick, () => setOpen(!open)),
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "aria-controls": open ? contentId : undefined,
    // Only while open: a closed trigger's Escape belongs to whatever encloses it.
    onKeyDown: open ? composeEventHandlers(props.onKeyDown, onEscape(() => setOpen(false))) : props.onKeyDown,
  });
  return (
    <ButtonOrSlot asChild={asChild} {...(triggerProps as ButtonProps)}>
      {children}
    </ButtonOrSlot>
  );
}

export type PopoverContentProps = ComponentPropsWithRef<"div"> & {
  /** Draw a pointer back at the trigger. */
  arrow?: boolean;
  /**
   * Where focus goes on open: the first tabbable element (default), or a ref.
   * The panel itself takes focus when it holds nothing tabbable.
   */
  initialFocus?: number | RefObject<HTMLElement | null>;
  classNames?: SlotClassNames<"arrow">;
};

/**
 * The panel: `role="dialog"`, non-modal. Focus moves in on open and back to the
 * trigger on close; Tab out of it, a press outside it or Escape closes it.
 *
 * Named by the trigger's text unless you name it yourself (`aria-label`, or
 * `aria-labelledby` pointing at a heading inside it): a trigger that reads
 * "Filters" names a panel of filters, an icon trigger names it by its label.
 *
 * Rendered in place (a DOM sibling of the trigger) and promoted to the top
 * layer, so it inherits density, direction and colour from where it is written
 * and no `overflow` ancestor clips it.
 */
function PopoverContent({
  arrow = false,
  initialFocus = 0,
  className,
  classNames,
  children,
  style,
  ref,
  onKeyDown,
  ...props
}: PopoverContentProps) {
  const { open, present, panelRef, setOpen, contentId, triggerId, floating, arrowRef, getFloatingProps } = usePopover("Content");
  if (!present) return null;
  return (
    // Disabled once closed: that is what hands focus back, at once rather than
    // after the exit transition.
    <FloatingFocusManager context={floating.context} modal={false} initialFocus={initialFocus} disabled={!open}>
      <div
        {...getFloatingProps({
          ...props,
          onKeyDown: composeEventHandlers(onKeyDown, onEscape(() => setOpen(false))),
        })}
        ref={mergeRefs(ref, panelRef, floating.refs.setFloating)}
        id={contentId}
        role="dialog"
        aria-labelledby={props["aria-labelledby"] ?? (props["aria-label"] ? undefined : triggerId)}
        // Leaving: on screen for its exit, but no longer interactive.
        inert={!open}
        style={{ ...floating.floatingStyles, ...style }}
        className={cn(
          "r-overlays-surface rounded-md border border-border bg-surface-0 p-r3 text-body-1 text-fg-primary shadow-md outline-none focus-visible:focus-ring",
          className
        )}
      >
        {children}
        {arrow && (
          <div
            ref={arrowRef}
            aria-hidden
            {...floatingArrowProps(floating.placement, floating.middlewareData.arrow)}
            className={cn("r-overlays-arrow absolute size-r3 rotate-45 bg-inherit", classNames?.arrow)}
          />
        )}
      </div>
    </FloatingFocusManager>
  );
}

export type PopoverCloseProps = ButtonProps & {
  /** Put the close behaviour on your own single child instead of a `Button`. */
  asChild?: boolean;
};

/** Closes the popover. Focus returns to the trigger. */
function PopoverClose({ asChild = false, onClick, ...props }: PopoverCloseProps) {
  const { setOpen } = usePopover("Close");
  return <ButtonOrSlot asChild={asChild} {...props} onClick={composeEventHandlers(onClick, () => setOpen(false))} />;
}

export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Close: PopoverClose,
});
