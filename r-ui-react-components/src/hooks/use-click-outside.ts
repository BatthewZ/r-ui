"use client";
import { useEffect, useRef } from "react";

/**
 * Fires on `mousedown`/`touchstart`, not `click`, so a press that begins outside
 * closes before the click lands. The consequence is that a control which itself
 * toggles the element acts one event *later* and would undo this: the handler
 * receives the event so a caller can recognise its own trigger and stand down.
 */
export function useClickOutside(
  ref: React.RefObject<Element | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  enabled = true
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      handlerRef.current(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, enabled]);
}
