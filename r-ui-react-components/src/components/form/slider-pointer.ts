"use client";
import { type PointerEvent, useRef } from "react";

import { isRtl } from "../../util/direction";
import { clamp } from "./slider-core";

/** Where a pointer sits over an element, 0–1: `x` from its inline start (RTL-aware), `y` down from its top. */
export function pointerFraction(el: Element, event: { clientX: number; clientY: number }) {
  const r = el.getBoundingClientRect();
  const fx = r.width > 0 ? clamp((event.clientX - r.left) / r.width, 0, 1) : 0;
  const fy = r.height > 0 ? clamp((event.clientY - r.top) / r.height, 0, 1) : 0;
  return { x: isRtl(el) ? 1 - fx : fx, y: fy };
}

export interface PointerDragHandlers<E extends HTMLElement> {
  /** A primary press: decide what it grabs and return the keyboard control to focus (or nothing). */
  grab: (event: PointerEvent<E>) => HTMLElement | null | undefined;
  /** The press, then every move of that pointer until it is released. */
  move: (event: PointerEvent<E>) => void;
  /** Once per press: on release, on cancel, or when the capture is lost. */
  release?: () => void;
}

/**
 * Pointer drag on a surface. A primary press captures the pointer (the drag
 * follows outside the surface), focuses the control `grab` returns without
 * scrolling (keys continue from where the press left), and moves there.
 * `release` runs exactly once per press.
 */
export function usePointerDrag<E extends HTMLElement>({ grab, move, release }: PointerDragHandlers<E>) {
  const active = useRef<number | null>(null);
  const end = (event: PointerEvent<E>) => {
    if (active.current !== event.pointerId) return;
    active.current = null;
    release?.();
  };
  return {
    onPointerDown(event: PointerEvent<E>) {
      if (event.button !== 0) return;
      // Before the press's default action, which would focus (or select) something else.
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      active.current = event.pointerId;
      grab(event)?.focus({ preventScroll: true });
      move(event);
    },
    onPointerMove(event: PointerEvent<E>) {
      if (active.current === event.pointerId) move(event);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: end,
  };
}
