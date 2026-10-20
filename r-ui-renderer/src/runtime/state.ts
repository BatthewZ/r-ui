export interface ViewState {
  readonly state: { readonly [key: string]: unknown };
  /** `path` starts with `state.`; plain objects merge shallowly, anything else replaces. */
  readonly setState: (path: string, value: unknown) => void;
}

/**
 * The view's `state`, seeded from the document's `state` once that object has
 * closed (`seed` is undefined until then) and never re-seeded for the same view.
 */
export function useViewState(seed: unknown): ViewState {
  throw new Error("not implemented");
}

/** `state` with `value` written at `path` (without the `state.` root); never mutates. */
export function setAtPath(
  state: { readonly [key: string]: unknown },
  segments: readonly string[],
  value: unknown,
): { readonly [key: string]: unknown } {
  throw new Error("not implemented");
}
