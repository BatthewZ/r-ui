import type { Ref, RefObject } from "react";

export function mergeRefs<T>(...refs: (Ref<T> | undefined | null)[]): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as RefObject<T | null>).current = node;
      }
    }
  };
}
