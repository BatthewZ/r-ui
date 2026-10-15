"use client";
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
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
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from "../../hooks/use-floating";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { Button, type ButtonProps } from "../primitives";
import { onEscape, Slot } from "./internal";

type Floating = ReturnType<typeof useFloating>;
type Interactions = ReturnType<typeof useInteractions>;

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentId: string;
  floating: Floating;
  arrowRef: React.RefObject<HTMLDivElement | null>;
  getReferenceProps: Interactions["getReferenceProps"];
  getFloatingProps: Interactions["getFloatingProps"];
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopover(part: string) {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error(`Popover.${part} must be used inside <Popover>`);
  return ctx;
}

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** @default "bottom" */
  placement?: Placement;
  children: ReactNode;
}

function PopoverRoot({ open: openProp, defaultOpen = false, onOpenChange, placement = "bottom", children }: PopoverProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const contentId = useId();
  const arrowRef = useRef<HTMLDivElement>(null);
  const floating = useFloating({ placement, offsetPx: 8, arrowRef, open, onOpenChange: setOpen });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(floating.context),
    // Light dismiss from the pointer. Escape is handled on the elements
    // (`onEscape`) so a nested surface closes first and alone.
    useDismiss(floating.context, { escapeKey: false }),
  ]);

  const value = useMemo(
    () => ({ open, setOpen, contentId, floating, arrowRef, getReferenceProps, getFloatingProps }),
    [open, setOpen, contentId, floating, getReferenceProps, getFloatingProps]
  );
  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>;
}

export type PopoverTriggerProps = ButtonProps & {
  /** Put the trigger behaviour on your own single child instead of a `Button`. */
  asChild?: boolean;
};

function PopoverTrigger({ asChild = false, children, ...props }: PopoverTriggerProps) {
  const { open, setOpen, contentId, floating, getReferenceProps } = usePopover("Trigger");
  const triggerProps = getReferenceProps({
    ...props,
    ref: mergeRefs(props.ref, floating.refs.setReference),
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "aria-controls": open ? contentId : undefined,
    // Only while open: a closed trigger's Escape belongs to whatever encloses it.
    onKeyDown: open ? composeEventHandlers(props.onKeyDown, onEscape(() => setOpen(false))) : props.onKeyDown,
  });
  if (asChild) return <Slot {...triggerProps}>{children}</Slot>;
  return (
    <Button variant="secondary" {...(triggerProps as ButtonProps)}>
      {children}
    </Button>
  );
}

export type PopoverContentProps = ComponentPropsWithRef<"div"> & {
  /** Draw a pointer back at the trigger. */
  arrow?: boolean;
  /**
   * Where focus goes on open: the first tabbable element (default), or a ref.
   * The panel itself takes focus when it holds nothing tabbable.
   */
  initialFocus?: number | React.RefObject<HTMLElement | null>;
  classNames?: SlotClassNames<"arrow">;
};

/**
 * The panel: `role="dialog"`, non-modal. Focus moves in on open and back to the
 * trigger on close; Tab out of it, a press outside it or Escape closes it.
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
  const { open, setOpen, contentId, floating, arrowRef, getFloatingProps } = usePopover("Content");
  if (!open) return null;
  return (
    <FloatingFocusManager context={floating.context} modal={false} initialFocus={initialFocus}>
      <div
        {...getFloatingProps({
          ...props,
          onKeyDown: composeEventHandlers(onKeyDown, onEscape(() => setOpen(false))),
        })}
        ref={mergeRefs(ref, floating.refs.setFloating)}
        id={contentId}
        role="dialog"
        style={{ ...floating.floatingStyles, ...style }}
        className={cn(
          "max-w-[min(var(--MEASURE),calc(100vw-var(--R-SIZE-2)*2))] rounded-md border border-border bg-surface-0 p-r3 text-body-1 text-fg-primary shadow-md animate-fade-in outline-none focus-visible:focus-ring",
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
function PopoverClose({ asChild = false, onClick, children, ...props }: PopoverCloseProps) {
  const { setOpen } = usePopover("Close");
  const handleClick = composeEventHandlers(onClick, () => setOpen(false));
  if (asChild) return <Slot {...props} onClick={handleClick}>{children}</Slot>;
  return (
    <Button variant="secondary" {...props} onClick={handleClick}>
      {children}
    </Button>
  );
}

export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Close: PopoverClose,
});
