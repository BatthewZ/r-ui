"use client";
import { useSyncExternalStore } from "react";

/** A subscription to something that never changes (no store, or a value fixed for the page's life). */
export const subscribeNothing = () => () => {};

/**
 * `read(store)`, re-read whenever the store changes; `undefined` without a
 * store. `read` must return a cached (or primitive) value while nothing
 * changed, or React re-renders forever.
 */
export function useStoreSnapshot<S extends { subscribe: (listener: () => void) => () => void }, T>(
  store: S | null | undefined,
  read: (store: S) => T,
): T | undefined {
  const getSnapshot = () => (store ? read(store) : undefined);
  return useSyncExternalStore(store?.subscribe ?? subscribeNothing, getSnapshot, getSnapshot);
}
