"use client";
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { type OpenStateProps, Slot } from "./internal";
import {
  type FocusIntent,
  type MenuCheckboxItemProps,
  type MenuContentProps,
  type MenuItemProps,
  menuParts,
  MenuProvider,
  type MenuRadioGroupProps,
  type MenuRadioItemProps,
  useMenu,
  useMenuRoot,
} from "./menu-internals";

export interface ContextMenuProps extends OpenStateProps {
  children: ReactNode;
}

function ContextMenuRoot({ open, defaultOpen, onOpenChange, children }: ContextMenuProps) {
  // What had focus when the menu opened, so closing hands it back.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const menu = useMenuRoot({
    open,
    defaultOpen,
    onOpenChange,
    // The panel's start corner sits on the point, as a native context menu's does.
    placement: "bottom-start",
    offset: "--R-SIZE-6",
    returnFocusRef,
  });
  return <MenuProvider value={menu}>{children}</MenuProvider>;
}

/** How long a touch must rest before it opens the menu. */
const LONG_PRESS_MS = 500;
/** How far a resting touch may drift (CSS pixels) before it counts as a scroll or a drag. */
const LONG_PRESS_SLOP = 10;

export type ContextMenuTriggerProps = ComponentPropsWithRef<"div"> & {
  /** Put the trigger behaviour on your own single child (a table, a card) instead of a `div`. */
  asChild?: boolean;
  /** Leave the browser's own menu in place. */
  disabled?: boolean;
  /**
   * Called before the menu opens with the element it is for: the element under
   * the pointer, or the focused element for a keyboard open. Read the row or
   * item it belongs to here (`target.closest("tr")`); return `false` to leave
   * the browser's own menu instead (a right-click on a header, say).
   */
  onBeforeOpen?: (target: Element) => boolean | void;
};

/** A zero-size box at a viewport point: the anchor floating-ui positions against. */
function pointRect(x: number, y: number) {
  return { x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 };
}

/** Shift+F10 and the Menu key: the keyboard's right-click. */
function isContextMenuKey(event: KeyboardEvent) {
  return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey);
}

/**
 * The region the menu belongs to. A right-click opens the menu at the pointer;
 * Shift+F10 or the Menu key opens it at the focused element (so the region, or
 * something in it, must be focusable: a row's button, a `tabIndex={0}` canvas);
 * a touch held still for half a second opens it under the finger, and a touch
 * that moves (a scroll) never does.
 */
function ContextMenuTrigger({
  asChild = false,
  disabled = false,
  onBeforeOpen,
  children,
  className,
  ref,
  onContextMenu,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onMouseDownCapture,
  onClickCapture,
  ...props
}: ContextMenuTriggerProps) {
  const { openWith, returnFocusRef, floating } = useMenu("ContextMenu.Trigger");
  const regionRef = useRef<HTMLElement | null>(null);
  const press = useRef<{ x: number; y: number; timer: number; target: Element } | null>(null);
  /**
   * A long press opened the menu: the mouse events its release produces must not
   * reach the page (the mousedown would move focus out of the menu, the click
   * would activate what is under the finger).
   */
  const swallowClick = useRef(false);

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(() => cancelPress, []);

  /**
   * Opens anchored to `at`: a point (pointer) or an element's box (keyboard).
   * The anchor is measured against the region on every read, so the menu
   * follows its content when the page scrolls and hides with it.
   */
  const openAt = (target: Element, at: { x: number; y: number } | null, intent: FocusIntent) => {
    const region = regionRef.current;
    if (disabled || !region || onBeforeOpen?.(target) === false) return false;
    const active = document.activeElement;
    returnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : region.tabIndex >= 0 ? region : null;
    if (at) {
      const origin = region.getBoundingClientRect();
      const dx = at.x - origin.left;
      const dy = at.y - origin.top;
      floating.refs.setPositionReference({
        contextElement: region,
        getBoundingClientRect: () => {
          const now = region.getBoundingClientRect();
          return pointRect(now.left + dx, now.top + dy);
        },
      });
    } else {
      floating.refs.setPositionReference({ contextElement: target, getBoundingClientRect: () => target.getBoundingClientRect() });
    }
    openWith(intent);
    return true;
  };

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    // A long press already opened it (iOS fires no contextmenu, Android does).
    if (swallowClick.current) {
      event.preventDefault();
      return;
    }
    // The platform's own long press (Android, sooner than ours) owns this press:
    // a timer left running would reopen the menu with focus already inside it.
    cancelPress();
    const native = event.nativeEvent as globalThis.PointerEvent;
    const pointerType = native.pointerType ?? "mouse";
    // A keyboard-made contextmenu (an engine that ignored the keydown below):
    // Chromium reports button -1, the Pointer Events spec an empty pointerType.
    const fromKeyboard = pointerType === "" || (pointerType === "mouse" && event.button !== 2 && !event.ctrlKey);
    const target = fromKeyboard ? (document.activeElement ?? event.currentTarget) : (event.target as Element);
    const opened = openAt(target, fromKeyboard ? null : { x: event.clientX, y: event.clientY }, fromKeyboard ? "first" : "menu");
    if (!opened) return;
    // Handled: no browser menu, and an enclosing region (which ignores a
    // prevented event) stays shut, so only the innermost of nested regions opens.
    event.preventDefault();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!isContextMenuKey(event)) return;
    const target = (document.activeElement as Element | null) ?? event.currentTarget;
    // Prevented, so the engine sends no contextmenu of its own after it, and an
    // enclosing region leaves it alone.
    if (openAt(target, null, "first")) event.preventDefault();
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    swallowClick.current = false;
    if (event.pointerType !== "touch" || disabled) return;
    cancelPress();
    const point = { x: event.clientX, y: event.clientY };
    const target = event.target as Element;
    press.current = {
      ...point,
      target,
      timer: window.setTimeout(() => {
        press.current = null;
        if (openAt(target, point, "menu")) swallowClick.current = true;
      }, LONG_PRESS_MS),
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = press.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) cancelPress();
  };

  const regionProps = {
    ...props,
    ref: mergeRefs(ref, regionRef),
    // No callout or text selection under a held finger.
    className: cn("r-overlays-context-region", className),
    onContextMenu: composeEventHandlers(onContextMenu, handleContextMenu),
    onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown),
    onPointerDown: composeEventHandlers(onPointerDown, handlePointerDown),
    onPointerMove: composeEventHandlers(onPointerMove, handlePointerMove),
    onPointerUp: composeEventHandlers(onPointerUp, cancelPress),
    onPointerCancel: composeEventHandlers(onPointerCancel, cancelPress),
    onMouseDownCapture: composeEventHandlers(onMouseDownCapture, (event: MouseEvent) => {
      if (swallowClick.current) event.preventDefault();
    }),
    onClickCapture: composeEventHandlers(onClickCapture, (event: MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }),
  };
  if (asChild) return <Slot {...regionProps}>{children}</Slot>;
  return <div {...regionProps}>{children}</div>;
}

export type ContextMenuContentProps = MenuContentProps;
export type ContextMenuItemProps = MenuItemProps;
export type ContextMenuCheckboxItemProps = MenuCheckboxItemProps;
export type ContextMenuRadioGroupProps = MenuRadioGroupProps;
export type ContextMenuRadioItemProps = MenuRadioItemProps;

/**
 * A menu for a region, opened where the reader points: right-click, Shift+F10
 * or the Menu key, or a long press. The panel, items and keyboard model are
 * DropdownMenu's; name the panel with `aria-label` on `Content` (nothing visible
 * labels it). Every action in it should also be reachable another way (a row's
 * actions button): a context menu is a shortcut, not the only door.
 */
export const ContextMenu = Object.assign(ContextMenuRoot, { Trigger: ContextMenuTrigger, ...menuParts });
