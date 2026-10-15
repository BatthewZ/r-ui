"use client";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useRef,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import {
  floatingArrowProps,
  type Placement,
  safePolygon,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
} from "../../hooks/use-floating";
import { mergeProps } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { topLayerExit, useExitPresence } from "./internal";

export interface TooltipProps {
  /**
   * A short supplementary description. Never the only place important
   * information lives: touch users never see it and it only describes, it does
   * not name. An icon-only control still needs its own `aria-label`.
   */
  content: ReactNode;
  /** One element that can take focus. It receives the ref and the handlers. */
  children: ReactElement;
  /** @default "top" */
  placement?: Placement;
  /** Hover delay before opening, in ms. Focus opens at once. @default 400 */
  delay?: number;
  /** Draw a pointer back at the trigger. */
  arrow?: boolean;
  /** Suppress the tooltip without unwrapping the trigger. */
  disabled?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Classes for the bubble. */
  className?: string;
  classNames?: SlotClassNames<"arrow">;
}

/**
 * A hover/focus description for one element.
 *
 * - Opens on mouse hover (after `delay`) and on keyboard focus (`:focus-visible`
 *   only). A touch tap never opens it, so it never sits on top of what the
 *   finger was aiming at, and the tap goes straight through to the trigger.
 * - Escape closes it without closing whatever surface it sits in.
 * - Wired as `aria-describedby` (appended to any the trigger already has).
 * - Rendered in place, right after the trigger, and promoted to the top layer:
 *   it inherits the density, direction and colour of where it is written and is
 *   never clipped by an ancestor.
 */
export function Tooltip({
  content,
  children,
  placement = "top",
  delay = 400,
  arrow = false,
  disabled = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  classNames,
}: TooltipProps) {
  const [open, setOpen] = useControllableState({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const shown = open && !disabled;
  const id = useId();
  const arrowRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const present = useExitPresence(shown, bubbleRef, topLayerExit);

  const { refs, floatingStyles, context, placement: resolved, middlewareData } = useFloating({
    placement,
    offsetPx: arrow ? 10 : 6,
    arrowRef,
    // Positioned and promoted for as long as it is on screen, exit included.
    open: present,
    onOpenChange: setOpen,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    // `mouseOnly`: a touch "hover" is a tap, and a tap belongs to the trigger.
    useHover(context, {
      enabled: !disabled,
      mouseOnly: true,
      delay: { open: delay, close: 80 },
      // WCAG 1.4.13: the pointer can cross the gap onto the bubble.
      handleClose: safePolygon(),
    }),
    useFocus(context, { enabled: !disabled, visibleOnly: true }),
    // Escape is ours (below), so a tooltip inside a popover or dialog closes
    // alone; a press on the trigger dismisses it, as activating the control
    // makes the description moot.
    useDismiss(context, { escapeKey: false, referencePress: true }),
  ]);

  if (!isValidElement(children)) return children;
  const child = children as ReactElement<Record<string, unknown>>;
  const childDescribedBy = child.props["aria-describedby"] as string | undefined;

  const trigger = cloneElement(
    child,
    mergeProps(
      child.props,
      getReferenceProps({
        ref: refs.setReference,
        // A list: append, never replace what the trigger already points at.
        "aria-describedby":
          [childDescribedBy, shown ? id : undefined].filter(Boolean).join(" ") || undefined,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key !== "Escape" || !shown || event.defaultPrevented) return;
          event.preventDefault();
          setOpen(false);
        },
      }) as Record<string, unknown>
    )
  );

  return (
    <>
      {trigger}
      {present && (
        <span
          ref={mergeRefs(bubbleRef, refs.setFloating)}
          {...getFloatingProps()}
          id={id}
          role="tooltip"
          inert={!shown}
          style={floatingStyles}
          className={cn(
            "r-overlays-surface block max-w-[calc(var(--MEASURE)/2)] rounded-sm bg-fg-primary px-r5 py-r6 text-body-2 text-fg-inverse shadow-sm",
            className
          )}
        >
          {content}
          {arrow && (
            <span
              ref={arrowRef}
              aria-hidden
              {...floatingArrowProps(resolved, middlewareData.arrow)}
              className={cn("absolute size-r4 rotate-45 bg-inherit", classNames?.arrow)}
            />
          )}
        </span>
      )}
    </>
  );
}
