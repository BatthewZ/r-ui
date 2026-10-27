"use client";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from "react";

/** How far (CSS px) a mouse or pen press travels before it becomes a drag; less is a click. */
export const DRAG_THRESHOLD = 4;
/** How long a touch rests before it picks something up; moving first is a scroll. */
export const LONG_PRESS_MS = 400;
/** How far (CSS px) a resting touch may drift before it counts as a scroll. */
export const LONG_PRESS_SLOP = 10;
/** The band (CSS px) along a scroller's edge where a drag scrolls it, and the speed at the edge (px per frame). */
const EDGE_ZONE = 48;
const EDGE_SPEED = 16;

/** Form controls keep their own presses: a drag never starts in one. */
const FORM_CONTROL = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

/**
 * Scroll speed for a pointer at `pointer` between a scroller's `start` and `end`
 * edges: 0 in the middle, rising to `max` (negative toward the start) across a
 * band of `edge`, at most a third of the scroller.
 */
export function edgeSpeed(pointer: number, start: number, end: number, edge: number, max: number): number {
  const zone = Math.min(edge, (end - start) / 3);
  if (zone <= 0) return 0;
  if (pointer < start + zone) return -max * Math.min(1, (start + zone - pointer) / zone);
  if (pointer > end - zone) return max * Math.min(1, (pointer - (end - zone)) / zone);
  return 0;
}

/** The nearest ancestor that scrolls vertically, else the document's scroller. */
export function verticalScroller(from: Element | null): Element | null {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight) return el;
  }
  return document.scrollingElement;
}

/** Scrolls `el` by `delta` on one axis; whether it moved. */
function nudge(el: Element, axis: "x" | "y", delta: number): boolean {
  if (delta === 0) return false;
  const step = delta > 0 ? Math.max(1, Math.round(delta)) : Math.min(-1, Math.round(delta));
  const before = axis === "x" ? el.scrollLeft : el.scrollTop;
  if (axis === "x") el.scrollLeft += step;
  else el.scrollTop += step;
  return (axis === "x" ? el.scrollLeft : el.scrollTop) !== before;
}

/** One press, from pointerdown to release, and whether it became a drag. */
export interface PressDrag<T> {
  payload: T;
  /** The element pressed (it captures the pointer once the drag starts). */
  element: HTMLElement;
  pointerType: string;
  /** Where the press began and where the pointer is now (client px). */
  x0: number;
  y0: number;
  x: number;
  y: number;
}

export interface UsePressDragOptions<T> {
  /**
   * The press became a drag: past `DRAG_THRESHOLD` for a mouse or pen, held
   * `LONG_PRESS_MS` for a touch. Return `false` to refuse it (it ends quietly).
   */
  onStart: (drag: PressDrag<T>) => boolean | void;
  /** The pointer moved during the drag, or a scroller moved under it. */
  onMove: (drag: PressDrag<T>) => void;
  /** Released (`"drop"`) or abandoned (`"cancel"`: Escape, or the browser took the pointer). */
  onEnd: (drag: PressDrag<T>, how: "drop" | "cancel") => void;
  /**
   * A press began, before anyone knows whether it is a click or a drag: show
   * at once what the press will act on (a slot about to be picked).
   */
  onPress?: (press: PressDrag<T>) => void;
  /**
   * A press ended without ever becoming a drag: released (its click follows,
   * in the same input), cancelled, a touch that turned into a scroll, or one
   * `onStart` refused. Undo what `onPress` showed, after the click has had its turn.
   */
  onRelease?: (press: PressDrag<T>) => void;
  /**
   * Scrollers that move while the pointer nears their edges during a drag,
   * each on the axes it overflows; the page's scroller (the nearest vertical
   * scroller around the `rootRef` element) is added.
   */
  scrollers?: () => readonly (Element | null | undefined)[];
  /** No new press starts while false (a press already under way finishes). */
  enabled?: boolean;
}

export interface PressDragHandle<T> {
  /** Call from an element's `onPointerDown` with what the press is about. */
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, payload: T) => void;
  /**
   * The ref for the element the presses happen inside. It carries a
   * non-passive `touchmove` listener for its whole life, so a touch that has
   * picked something up drags it instead of scrolling: a listener added at the
   * long press would come after the browser had already decided that touch's
   * moves cannot be cancelled.
   */
  rootRef: (element: HTMLElement | null) => void;
  /** Whether a drag is under way now (read in handlers, not for rendering). */
  isDragging: () => boolean;
}

interface Press<T> extends PressDrag<T> {
  pointerId: number;
  touch: boolean;
  active: boolean;
  page: Element | null;
  timer: number;
  frame: number;
  cleanup: () => void;
}

/**
 * Turns presses into drags the way every draggable part of the library does:
 * a mouse or pen press is a click until it travels a few pixels; a touch picks
 * up after resting still and is a scroll if it moves first; the pointer is
 * captured; listed scrollers and the page scroll at their edges; Escape
 * cancels; and the click a real drag's release would cause is swallowed once,
 * so a dragged link or button does not also follow or press. The caller only
 * turns pointer positions into targets (`onMove`) and commits (`onEnd`).
 */
export function usePressDrag<T>({
  onStart,
  onMove,
  onEnd,
  onPress,
  onRelease,
  scrollers,
  enabled = true,
}: UsePressDragOptions<T>): PressDragHandle<T> {
  const press = useRef<Press<T> | null>(null);
  const root = useRef<HTMLElement | null>(null);
  // The latest callbacks, read by window listeners that outlive a render.
  const latest = useRef({ onStart, onMove, onEnd, onPress, onRelease, scrollers });
  latest.current = { onStart, onMove, onEnd, onPress, onRelease, scrollers };

  const endPress = useCallback((p: Press<T>, how: "drop" | "cancel" | null) => {
    p.cleanup();
    if (press.current === p) press.current = null;
    // A drag ends with how it ended; a press that never became one, quietly.
    if (how) latest.current.onEnd(p, how);
    else latest.current.onRelease?.(p);
  }, []);

  const autoScroll = (p: Press<T>) => {
    let moved = false;
    for (const scroller of latest.current.scrollers?.() ?? []) {
      if (!scroller) continue;
      const r = scroller.getBoundingClientRect();
      if (scroller.scrollWidth > scroller.clientWidth && p.y >= r.top && p.y <= r.bottom) {
        moved = nudge(scroller, "x", edgeSpeed(p.x, r.left, r.right, EDGE_ZONE, EDGE_SPEED)) || moved;
      }
      if (scroller.scrollHeight > scroller.clientHeight && p.x >= r.left && p.x <= r.right) {
        moved = nudge(scroller, "y", edgeSpeed(p.y, r.top, r.bottom, EDGE_ZONE, EDGE_SPEED)) || moved;
      }
    }
    if (p.page) {
      const isDocument = p.page === document.scrollingElement;
      const r = isDocument ? { top: 0, bottom: window.innerHeight } : p.page.getBoundingClientRect();
      moved = nudge(p.page, "y", edgeSpeed(p.y, r.top, r.bottom, EDGE_ZONE, EDGE_SPEED)) || moved;
    }
    if (moved) latest.current.onMove(p);
  };

  const activate = (p: Press<T>) => {
    if (latest.current.onStart(p) === false) return endPress(p, null);
    p.active = true;
    // The page is what scrolls around the whole draggable area, found from its root: from the
    // pressed element it would be the area's own scroller (a list, a time grid), scrolled twice.
    p.page = verticalScroller(root.current ?? p.element);
    window.getSelection()?.removeAllRanges();
    try {
      p.element.setPointerCapture(p.pointerId);
    } catch {
      // The pointer is already gone (released between the timer and now); its next event ends the press.
    }
    const loop = () => {
      autoScroll(p);
      p.frame = requestAnimationFrame(loop);
    };
    p.frame = requestAnimationFrame(loop);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, payload: T) => {
    if (!enabled || press.current) return;
    if (!event.isPrimary || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(FORM_CONTROL)) return;
    const p: Press<T> = {
      payload,
      element: event.currentTarget,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      touch: event.pointerType === "touch",
      x0: event.clientX,
      y0: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      page: null,
      timer: 0,
      frame: 0,
      cleanup: () => {},
    };
    const ours = (e: PointerEvent) => e.pointerId === p.pointerId;
    const onMoveEvent = (e: PointerEvent) => {
      if (!ours(e)) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!p.active) {
        const distance = Math.hypot(p.x - p.x0, p.y - p.y0);
        // A touch that moves before the long press is a scroll; a mouse that moves far enough is a drag.
        if (p.touch) {
          if (distance > LONG_PRESS_SLOP) endPress(p, null);
          return;
        }
        if (distance < DRAG_THRESHOLD) return;
        activate(p);
        if (!p.active) return;
      }
      latest.current.onMove(p);
    };
    const onUp = (e: PointerEvent) => {
      if (!ours(e)) return;
      if (!p.active) return endPress(p, null);
      p.x = e.clientX;
      p.y = e.clientY;
      latest.current.onMove(p);
      endPress(p, "drop");
      // The release's click would follow a link or press a button under it.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    };
    const onCancel = (e: PointerEvent) => {
      if (ours(e)) endPress(p, p.active ? "cancel" : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !p.active) return;
      e.preventDefault();
      e.stopPropagation();
      endPress(p, "cancel");
    };
    // A long press would otherwise open the system's menu or start a text selection.
    const onTouchDefault = (e: Event) => {
      if (p.touch) e.preventDefault();
    };
    window.addEventListener("pointermove", onMoveEvent);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onTouchDefault, true);
    window.addEventListener("selectstart", onTouchDefault, true);
    p.cleanup = () => {
      window.clearTimeout(p.timer);
      cancelAnimationFrame(p.frame);
      window.removeEventListener("pointermove", onMoveEvent);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onTouchDefault, true);
      window.removeEventListener("selectstart", onTouchDefault, true);
    };
    press.current = p;
    latest.current.onPress?.(p);
    if (p.touch) p.timer = window.setTimeout(() => activate(p), LONG_PRESS_MS);
  };

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (press.current?.active && e.cancelable) e.preventDefault();
  }, []);
  const rootRef = useCallback(
    (element: HTMLElement | null) => {
      root.current?.removeEventListener("touchmove", onTouchMove);
      root.current = element;
      element?.addEventListener("touchmove", onTouchMove, { passive: false });
    },
    [onTouchMove],
  );

  // An unmount mid-press leaves no window listener behind.
  useEffect(() => () => press.current?.cleanup(), []);

  return { onPointerDown, rootRef, isDragging: () => press.current?.active ?? false };
}
