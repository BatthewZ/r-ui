"use client";
import {
  cloneElement,
  isValidElement,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useLayoutEffect,
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
