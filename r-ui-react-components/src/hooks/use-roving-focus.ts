"use client";
import { type KeyboardEvent, useCallback, useRef, useState } from "react";

import { isRtl } from "../util/direction";

interface UseRovingFocusOptions {
  orientation: "horizontal" | "vertical";
  loop?: boolean;
}

interface RovingProps {
  tabIndex: number;
  onKeyDown: (e: KeyboardEvent) => void;
  ref: (el: HTMLElement | null) => void;
}

/** Natively disabled items cannot take focus, so the arrows pass over them. */
const focusable = (element: HTMLElement | undefined): element is HTMLElement =>
  element !== undefined && !element.matches(":disabled");

/**
 * A roving tab stop for a composite widget: one tab stop for the whole group,
 * arrow keys between its items.
 *
 * Two ways in, and a widget uses one or the other:
 *
 * - **`getRovingProps(i).onKeyDown`**: the built-in key model, for a widget
 *   where moving focus means nothing else (a toolbar, a menubar). It moves
 *   focus and nothing more. Arrows follow the orientation, and a horizontal
 *   group mirrors them under `dir="rtl"` (ArrowLeft is "next"). Home and End go
 *   to the ends. Natively `disabled` items are passed over, since they cannot
 *   take focus; an `aria-disabled` item stays in the walk (APG: it is
 *   discoverable, its widget refuses to activate it).
 * - **`setFocusedIndex`**: for a widget whose tab stop is *derived* from a
 *   value, as a `radiogroup`'s is (its tab stop must be the checked radio), so
 *   focus and selection are one state machine and the widget owns its keys.
 *
 * `setFocusedIndex` moves DOM focus with the tab stop **only when the group
 * already holds focus**, so it never pulls focus into the widget from
 * elsewhere, and it never leaves a `tabIndex={-1}` element focused.
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
        const elements = elementsRef.current;
        // Registered items in index order; an unmounted item leaves a gap, not a hole in the walk.
        const indices = [...elements.keys()].sort((a, b) => a - b);
        if (indices.length === 0) return;

        /** The next focusable item from `current` in `delta`'s direction, wrapping when `loop`. */
        const step = (current: number, delta: 1 | -1): number | undefined => {
          const n = indices.length;
          let position = indices.indexOf(current);
          if (position === -1) position = delta > 0 ? -1 : n;
          for (let tried = 0; tried < n; tried += 1) {
            position += delta;
            if (position < 0 || position >= n) {
              if (!loop) return undefined;
              position = (position + n) % n;
            }
            const candidate = indices[position]!;
            if (focusable(elements.get(candidate))) return candidate;
          }
          return undefined;
        };

        const mirrored = orientation === "horizontal" && isRtl(e.currentTarget);
        const nextKey = orientation === "horizontal" ? (mirrored ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
        const prevKey = orientation === "horizontal" ? (mirrored ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
        const current = focusedIndexRef.current;
        let nextIndex: number | undefined;

        switch (e.key) {
          case nextKey:
            nextIndex = step(current, 1);
            break;
          case prevKey:
            nextIndex = step(current, -1);
            break;
          case "Home":
            nextIndex = indices.find((i) => focusable(elements.get(i)));
            break;
          case "End":
            nextIndex = [...indices].reverse().find((i) => focusable(elements.get(i)));
            break;
          default:
            return;
        }

        // At an end without `loop`, the key is still ours: it must not scroll the page.
        e.preventDefault();
        // Focus follows from here: the handler runs on the focused item, so the
        // "already inside the group" test above is satisfied by definition.
        if (nextIndex !== undefined) setFocusedIndex(nextIndex);
      },
      ref: (el: HTMLElement | null) => {
        if (el) {
          elementsRef.current.set(index, el);
        } else {
          elementsRef.current.delete(index);
        }
      },
    }),
    [loop, orientation, setFocusedIndex]
  );

  return { getRovingProps, focusedIndex, setFocusedIndex };
}
