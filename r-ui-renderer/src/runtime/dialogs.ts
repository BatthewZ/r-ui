import { useCallback, useMemo, useRef, useState } from "react";

import { ownValue } from "../spec/guards";
import type { DialogState } from "./context";

type OpenMap = { readonly [dialogId: string]: boolean };

/**
 * Written state wins; an id never written reads the seed it was first asked
 * with (a node's `defaultOpen`), fixed from then on so the component stays
 * controlled with the same value it rendered with. A node still streaming may
 * not have its props yet: its read records nothing.
 */
export function useDialogState(): DialogState {
  const [open, setOpenMap] = useState<OpenMap>({});
  const seeds = useRef(new Map<string, boolean>());

  const setOpen = useCallback((dialogId: string, next: boolean) => {
    setOpenMap((current) => (ownValue(current, dialogId) === next ? current : { ...current, [dialogId]: next }));
  }, []);

  return useMemo<DialogState>(
    () => ({
      isOpen(dialogId, initial, pending) {
        const written = ownValue(open, dialogId);
        if (written !== undefined) return written;
        const known = seeds.current.get(dialogId);
        if (known !== undefined) return known;
        const seed = initial === true;
        if (pending !== true) seeds.current.set(dialogId, seed);
        return seed;
      },
      setOpen,
    }),
    [open, setOpen],
  );
}
