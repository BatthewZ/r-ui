import { useCallback, useMemo, useRef, useState } from "react";

import type { DialogState } from "./context";

type OpenMap = { readonly [dialogId: string]: boolean };

/**
 * Written state wins; an id never written reads the seed it was first asked
 * with (a node's `defaultOpen`), fixed from then on so the component stays
 * controlled with the same value it rendered with.
 */
export function useDialogState(): DialogState {
  const [open, setOpenMap] = useState<OpenMap>({});
  const seeds = useRef(new Map<string, boolean>());

  const setOpen = useCallback((dialogId: string, next: boolean) => {
    setOpenMap((current) => (Object.hasOwn(current, dialogId) && current[dialogId] === next ? current : { ...current, [dialogId]: next }));
  }, []);

  return useMemo<DialogState>(
    () => ({
      isOpen(dialogId, initial) {
        if (Object.hasOwn(open, dialogId)) return open[dialogId] === true;
        const known = seeds.current.get(dialogId);
        if (known !== undefined) return known;
        const seed = initial === true;
        seeds.current.set(dialogId, seed);
        return seed;
      },
      setOpen,
    }),
    [open, setOpen],
  );
}
