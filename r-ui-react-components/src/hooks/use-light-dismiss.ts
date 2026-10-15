"use client";
import { type MouseEvent, type PointerEvent, type RefObject, useCallback, useMemo, useRef } from "react";

import { composeEventHandlers } from "../util/merge-props";

interface UseLightDismissParams<E extends HTMLElement> {
  /** The panel itself. Its border box is what "outside" is measured against. */
  ref: RefObject<E | null>;
  /**
   * Off returns the caller's own handlers untouched, so a component can spread
   * the pair unconditionally and let a prop decide whether the behaviour exists.
   */
  enabled?: boolean;
  onDismiss: () => void;
  /** The caller's handlers, composed in ahead of this one. */
  onPointerDown?: (event: PointerEvent<E>) => void;
  onClick?: (event: MouseEvent<E>) => void;
}

interface UseLightDismissReturn<E extends HTMLElement> {
  onPointerDown: (event: PointerEvent<E>) => void;
  onClick: (event: MouseEvent<E>) => void;
}

/**
 * Dismissal by pressing outside a panel the browser puts in the top layer.
 *
 * `useClickOutside` cannot do this job and fails silently at it. A press on a
 * modal `<dialog>`'s scrim is dispatched at the dialog element itself, so a hook
 * that asks whether the target is contained by the ref is asking about the ref
 * itself: it answers "inside" for the scrim and "inside" for the panel, and can
 * never fire. Geometry is the only tell — the pointer landing beyond the panel's
 * own border box — and it has the side benefit that the padding a panel carries
 * still counts as part of it.
 *
 * Both ends of the press are required. Keyed on the release alone, selecting
 * text and dragging past the panel's edge dismisses it and throws away whatever
 * the user was editing: the click's target resolves to the common ancestor, the
 * dialog, and its coordinates are outside. A pointer-only manual pass does not
 * find that one.
 *
 * The returned handlers must be spread onto the element AFTER the caller's
 * props, not before. Before, a caller's own `onClick` replaces them and deletes
 * a documented behaviour with no error anywhere; after, the caller's handler
 * runs first and `preventDefault()` in it is an opt-out.
 */
export function useLightDismiss<E extends HTMLElement>({
  ref,
  enabled = true,
  onDismiss,
  onPointerDown,
  onClick,
}: UseLightDismissParams<E>): UseLightDismissReturn<E> {
  const pressedOutside = useRef(false);

  const isOutsidePanel = useCallback(
    (event: MouseEvent<E> | PointerEvent<E>) => {
      const panel = ref.current;
      // A press on anything the panel contains is inside by definition, and
      // asking geometry about it would be asking about the child's box.
      if (!panel || event.target !== panel) return false;
      const rect = panel.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    },
    [ref]
  );

  // `checkDefaultPrevented: false` so this half always runs: the record is state,
  // not behaviour, and skipping it would leave the previous press's verdict in
  // place to be read by the next click. The caller's opt-out is honoured by
  // recording `false` rather than by not recording.
  const handlePointerDown = useMemo(
    () =>
      composeEventHandlers<PointerEvent<E>>(
        onPointerDown,
        (event) => {
          pressedOutside.current = enabled && !event.defaultPrevented && isOutsidePanel(event);
        },
        { checkDefaultPrevented: false }
      ),
    [enabled, isOutsidePanel, onPointerDown]
  );

  const handleClick = useMemo(
    () =>
      composeEventHandlers<MouseEvent<E>>(onClick, (event) => {
        const startedOutside = pressedOutside.current;
        pressedOutside.current = false;
        if (enabled && startedOutside && isOutsidePanel(event)) onDismiss();
      }),
    [enabled, isOutsidePanel, onClick, onDismiss]
  );

  return { onPointerDown: handlePointerDown, onClick: handleClick };
}
