import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStoreSnapshot } from "./use-store-snapshot";

function counterStore() {
  let count = 0;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get: () => count,
    bump: () => {
      count += 1;
      for (const listener of listeners) listener();
    },
    listening: () => listeners.size,
  };
}

type Store = ReturnType<typeof counterStore>;

function Count({ store }: { store: Store | null }) {
  const count = useStoreSnapshot(store, (s) => s.get());
  return <output>{count === undefined ? "none" : String(count)}</output>;
}

describe("useStoreSnapshot", () => {
  it("re-reads on every change, and unsubscribes on unmount", () => {
    const store = counterStore();
    const { unmount } = render(<Count store={store} />);
    expect(screen.getByRole("status")).toHaveTextContent("0");
    expect(store.listening()).toBe(1);
    act(() => store.bump());
    act(() => store.bump());
    expect(screen.getByRole("status")).toHaveTextContent("2");
    unmount();
    expect(store.listening()).toBe(0);
  });

  it("is undefined without a store", () => {
    render(<Count store={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("none");
  });
});
