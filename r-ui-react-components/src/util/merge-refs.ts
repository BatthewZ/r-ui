import type { Ref, RefCallback } from "react";

/**
 * One callback ref that feeds every ref given. A callback ref that returns a
 * cleanup (React 19) gets that cleanup on detach rather than a `null` call,
 * exactly as it would attached on its own.
 */
export function mergeRefs<T>(...refs: (Ref<T> | undefined | null)[]): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") return ref(node);
      if (ref) ref.current = node;
      return undefined;
    });
    if (node === null) return;
    return () => {
      refs.forEach((ref, i) => {
        const cleanup = cleanups[i];
        if (typeof cleanup === "function") cleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      });
    };
  };
}
