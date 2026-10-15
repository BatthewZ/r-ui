"use client";
import {
  cloneElement,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { mergeProps } from "../../util/merge-props";

/**
 * `asChild`: hand the part's props to the caller's single element instead of
 * rendering our own. `mergeProps` composes handlers (the child's first), merges
 * `className` and the React 19 `ref` prop, so the child keeps everything it had.
 */
export function Slot({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) {
  if (!isValidElement(children)) return null;
  const child = children as ReactElement<Record<string, unknown>>;
  return cloneElement(child, mergeProps(child.props, props));
}

/**
 * Escape for a layered surface, handled on the element (not on `document`) so
 * nesting works: the innermost surface handles the key and `preventDefault()`s
 * it, every outer one sees `defaultPrevented` and stands down. The same
 * `preventDefault()` keeps an enclosing modal `<dialog>` from treating the key
 * as its own close request.
 */
export function onEscape(close: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    close();
  };
}

/**
 * Whether a part is mounted, for an IDREF that must not dangle: a Title or
 * Description registers itself, and the surface only points `aria-labelledby` /
 * `aria-describedby` at parts that exist.
 */
export function usePresence(): [boolean, (present: boolean) => void] {
  return useState(false);
}

export function useRegister(register: ((present: boolean) => void) | undefined) {
  useLayoutEffect(() => {
    if (!register) return;
    register(true);
    return () => register(false);
  }, [register]);
}

/**
 * Runs `done` once every exit now running on `element` has finished: the CSS
 * transitions or animations a closing surface starts on itself. At once when
 * none is running, which is the fallback for free: reduced motion collapses
 * them to ~0, an engine without `allow-discrete` hides the element before any
 * transition starts, and one without the Web Animations API (jsdom) reports
 * nothing. Event-driven rather than a timer, so a theme's slower motion tokens
 * need no matching number here. Returns a cancel.
 *
 * Read synchronously after the change that starts the exit: `getAnimations()`
 * flushes style, so the transitions it starts are already listed.
 */
export function afterExit(element: Element, done: () => void): () => void {
  const running =
    typeof element.getAnimations === "function"
      ? // A looping animation on the element itself (a pulse) never finishes.
        element.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      : [];
  if (running.length === 0) {
    done();
    return () => {};
  }
  let live = true;
  void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
    if (live) done();
  });
  return () => {
    live = false;
  };
}

export interface ExitPresenceOptions {
  /** Start the exit: take the element out of its open state (`hidePopover()`, `close()`). */
  leave: (element: HTMLElement) => void;
  /** Re-open an element that was still leaving when `open` came back. */
  reenter?: (element: HTMLElement) => void;
}

/**
 * Whether a closable surface should be rendered: while `open`, and after it
 * closes for as long as its CSS exit runs, so the panel transitions out instead
 * of vanishing. The exit itself is CSS (`transition-behavior: allow-discrete`
 * on `display` and `overlay`, see the group's styles.css); this only keeps the
 * node mounted until it has finished, then lets it unmount.
 *
 * Re-opened mid-exit, the same node is kept and `reenter` runs, so the
 * transition reverses from where it was.
 */
export function useExitPresence(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  { leave, reenter }: ExitPresenceOptions
): boolean {
  const [present, setPresent] = useState(open);
  if (open && !present) setPresent(true);

  // The latest callbacks, read by the effect without re-running it. A ref
  // rather than `useEffectEvent`, which needs React 19.2 (the peer range is 19).
  const options = useRef({ leave, reenter });
  useLayoutEffect(() => {
    options.current = { leave, reenter };
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (open) {
      if (element) options.current.reenter?.(element);
      return;
    }
    if (!present) return;
    if (!element) {
      setPresent(false);
      return;
    }
    options.current.leave(element);
    return afterExit(element, () => setPresent(false));
  }, [open, present, ref]);

  return present;
}

/** `leave` / `reenter` for a panel promoted with `popover` (see `useFloating`). */
export const topLayerExit: ExitPresenceOptions = {
  leave(element) {
    // Not promoted (no popover support): nothing transitions, so it unmounts at once.
    if (element.hasAttribute("popover") && element.matches(":popover-open")) element.hidePopover();
  },
  reenter(element) {
    if (element.hasAttribute("popover") && !element.matches(":popover-open")) element.showPopover();
  },
};
