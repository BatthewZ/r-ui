"use client";
import { type RefObject, useEffect, useMemo, useState } from "react";

import { useDebounce } from "../../hooks/use-debounce";
import type { CommandPaletteCommand, CommandPaletteCommands, CommandPaletteSearch } from "./CommandPalette";

export type SourceStatus = "ready" | "loading" | "error";

interface SourceState {
  commands: readonly CommandPaletteCommand[];
  status: SourceStatus;
}

/**
 * Starts `load` and hands its outcome to `settle` unless cancelled first.
 * Returns the cancel, which also aborts the request's signal.
 */
function loadCommands(
  load: (signal: AbortSignal) => Promise<readonly CommandPaletteCommand[]>,
  settle: (state: SourceState) => void,
): () => void {
  const controller = new AbortController();
  load(controller.signal).then(
    (commands) => {
      if (!controller.signal.aborted) settle({ commands, status: "ready" });
    },
    () => {
      if (!controller.signal.aborted) settle({ commands: [], status: "error" });
    },
  );
  return () => controller.abort();
}

/** A page's own commands: as given, or loaded once through the cache. */
export function usePageCommands(
  source: CommandPaletteCommands | undefined,
  cache: RefObject<WeakMap<object, readonly CommandPaletteCommand[]>>,
): SourceState {
  const isLoader = typeof source === "function";
  const cached = isLoader ? cache.current.get(source) : undefined;
  const [state, setState] = useState<SourceState & { source: unknown }>({
    source: undefined,
    commands: [],
    status: "loading",
  });

  useEffect(() => {
    if (typeof source !== "function" || cache.current.has(source)) return;
    setState({ source, commands: [], status: "loading" });
    return loadCommands(
      (signal) => source({ signal }),
      (next) => {
        if (next.status === "ready") cache.current.set(source, next.commands);
        setState({ source, ...next });
      },
    );
  }, [source, cache]);

  if (!isLoader) return { commands: source ?? [], status: "ready" };
  if (cached) return { commands: cached, status: "ready" };
  return state.source === source ? state : { commands: [], status: "loading" };
}

/**
 * Results of `search` for the (debounced) query on one page (`scope`, any value
 * that identifies it). Stale results stay up while the next ones load, but only
 * that page's own: another page's never show, and a query typed on another page
 * is never searched on this one.
 */
export function useSearchResults(
  search: CommandPaletteSearch | undefined,
  query: string,
  delayMs: number,
  scope: unknown,
): SourceState {
  const trimmed = query.trim();
  const typed = useMemo(() => ({ scope, query: trimmed }), [scope, trimmed]);
  const settled = useDebounce(typed, delayMs);
  const [state, setState] = useState<SourceState & { scope?: unknown }>({ commands: [], status: "ready" });

  const { scope: settledScope, query: settledQuery } = settled;

  useEffect(() => {
    if (!search || settledQuery === "" || settledScope !== scope) return;
    setState((prev) => (prev.scope === scope ? { ...prev, status: "loading" } : { scope, commands: [], status: "loading" }));
    return loadCommands((signal) => search(settledQuery, { signal }), (next) => setState({ scope, ...next }));
  }, [search, settledQuery, settledScope, scope]);

  if (!search || trimmed === "") return { commands: [], status: "ready" };
  if (state.scope !== scope) return { commands: [], status: "loading" };
  const pending = settledQuery !== trimmed || settledScope !== scope || state.status === "loading";
  return { commands: state.commands, status: pending ? "loading" : state.status };
}
