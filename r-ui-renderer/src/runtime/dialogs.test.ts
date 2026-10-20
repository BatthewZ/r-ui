import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDialogState } from "./dialogs";

describe("useDialogState", () => {
  it("is a boolean from the first read, seeded once by defaultOpen, and written state wins", () => {
    const { result } = renderHook(() => useDialogState());
    expect(result.current.isOpen("edit")).toBe(false);
    expect(result.current.isOpen("intro", true)).toBe(true);
    // The seed is fixed at the first read: a later defaultOpen does not flip a rendered dialog.
    expect(result.current.isOpen("edit", true)).toBe(false);

    act(() => result.current.setOpen("edit", true));
    expect(result.current.isOpen("edit")).toBe(true);
    act(() => result.current.setOpen("intro", false));
    expect(result.current.isOpen("intro", true)).toBe(false);
  });

  it("keeps its identity until a dialog opens or closes", () => {
    const { result, rerender } = renderHook(() => useDialogState());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    act(() => result.current.setOpen("edit", false));
    expect(result.current).not.toBe(first);
  });
});
