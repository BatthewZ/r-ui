"use client";
import { type KeyboardEvent, useCallback, useRef, useState } from "react";

interface UseRovingFocusOptions {
  orientation: "horizontal" | "vertical";
  loop?: boolean;
}

interface RovingProps {
  tabIndex: number;
  onKeyDown: (e: KeyboardEvent) => void;
  ref: (el: HTMLElement | null) => void;
}

/**
 * A roving tab stop for a composite widget: one tab stop for the whole group,
 * arrow keys between its items.
 *
 * Two ways in, and a widget uses one or the other:
 *
 * - **`getRovingProps(i).onKeyDown`** — the built-in key model, for a widget
 *   where moving focus means nothing else (a toolbar, a menubar). It moves
 *   focus and nothing more.
 * - **`setFocusedIndex`** — for a widget where the tab stop is *derived* from a
 *   value, which is what a `radiogroup` is: its tab stop must be the checked
 *   radio, so focus and selection are one state machine and the widget owns its
 *   own keys. Both in-package consumers (`Rating`, `ThemeSwitcher`) are that
 *   shape and take this route; each documents the reason on its own page.
 *
 * `setFocusedIndex` moves DOM focus with the tab stop **when the group already
 * holds focus**, so it never steals focus into the widget, and it never leaves
 * a `tabIndex={-1}` element focused. That last part used to be hand-rolled at
 * both call sites.
 */
export function useRovingFocus(options: UseRovingFocusOptions): {
  getRovingProps: (index: number) => RovingProps;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
} {
  const { orientation, loop = true } = options;
  const [focusedIndex, setFocusedIndexState] = useState(0);
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

  const elementsRef = useRef<Map<number, HTMLElement>>(new Map());

  const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";

  const setFocusedIndex = useCallback((index: number) => {
    setFocusedIndexState(index);
    const elements = elementsRef.current;
    const active = document.activeElement;
    // Only when focus is already inside the group: moving the tab stop while
    // the user is elsewhere on the page must not pull them here.
    for (const element of elements.values()) {
      if (element === active) {
        elements.get(index)?.focus();
        return;
      }
    }
  }, []);

  const getRovingProps = useCallback(
    (index: number): RovingProps => ({
      tabIndex: index === focusedIndexRef.current ? 0 : -1,
      onKeyDown: (e: KeyboardEvent) => {
        const count = elementsRef.current.size;
        if (count === 0) return;

        const current = focusedIndexRef.current;
        let nextIndex: number | undefined;

        switch (e.key) {
          case nextKey:
            nextIndex = loop
              ? (current + 1) % count
              : Math.min(current + 1, count - 1);
            break;
          case prevKey:
            nextIndex = loop
              ? (current - 1 + count) % count
              : Math.max(current - 1, 0);
            break;
          case "Home":
            nextIndex = 0;
            break;
          case "End":
            nextIndex = count - 1;
            break;
          default:
            return;
        }

        e.preventDefault();
        // Focus follows from here: the handler runs on the focused item, so the
        // "already inside the group" test above is satisfied by definition.
        setFocusedIndex(nextIndex);
      },
      ref: (el: HTMLElement | null) => {
        if (el) {
          elementsRef.current.set(index, el);
        } else {
          elementsRef.current.delete(index);
        }
      },
    }),
    [loop, nextKey, prevKey, setFocusedIndex]
  );

  return { getRovingProps, focusedIndex, setFocusedIndex };
}
