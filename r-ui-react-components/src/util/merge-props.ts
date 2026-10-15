import type { CSSProperties, Ref, SyntheticEvent } from "react";

import { mergeRefs } from "./merge-refs";
import { cn } from "./style";

type UnknownProps = Record<string, unknown>;

/**
 * The result of merging `A` with `B`.
 *
 * A shared key is typed as the union of both sides rather than `B`'s type: for
 * most keys `B` wins, but a `B` value of `undefined` leaves `A`'s in place, so
 * either can survive and only the union is sound.
 */
type MergedProps<A, B> = Omit<A, keyof B> & {
  [K in keyof B]: K extends keyof A ? A[K] | B[K] : B[K];
};

interface ComposeOptions {
  /**
   * Whether the caller may skip the component's own behaviour by calling
   * `preventDefault()`.
   *
   * Pass `false` for events the DOM does not let you cancel — `animationend`,
   * `transitionend`, `pointerleave`, `scroll`. React sets `defaultPrevented` on
   * its synthetic event even where the DOM ignores `preventDefault()`, so
   * honouring it on those events would invent an opt-out that silently
   * re-creates the dropped-behaviour bug this helper exists to prevent.
   */
  checkDefaultPrevented?: boolean;
}

/**
 * Runs a caller's event handler alongside the component's own, instead of
 * letting a later `{...props}` spread replace it.
 *
 * The caller's handler runs first so it can inspect the event and opt out of
 * the component's behaviour with `preventDefault()`.
 */
export function composeEventHandlers<E extends SyntheticEvent>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void,
  { checkDefaultPrevented = true }: ComposeOptions = {},
): (event: E) => void {
  return (event: E) => {
    theirs?.(event);
    if (checkDefaultPrevented && event.defaultPrevented) return;
    ours(event);
  };
}

const isEventHandlerName = (key: string) =>
  key.length > 2 && key.startsWith("on") && key.charCodeAt(2) >= 65 && key.charCodeAt(2) <= 90;

/**
 * Merges two prop objects without either one silently discarding the other.
 *
 * Written for the places a plain spread loses information: handing props to a
 * cloned `asChild` child, or spreading a rest object over attributes the
 * component set itself. Per key:
 *
 * - `on*` handlers **compose** — `a`'s runs first, then `b`'s unless `a` called
 *   `preventDefault()`. Use `composeEventHandlers` directly when the event is
 *   not cancelable.
 * - `className` merges through `cn`, so Tailwind conflicts resolve rather than
 *   concatenate.
 * - `style` merges by key, `b` winning.
 * - `ref` merges through `mergeRefs`, so both callbacks receive the node.
 * - everything else: `b` wins when it is not `undefined`.
 */
export function mergeProps<A extends UnknownProps, B extends UnknownProps>(
  a: A,
  b: B,
): MergedProps<A, B> {
  const merged: UnknownProps = { ...a };

  for (const key of Object.keys(b)) {
    const ours = a[key];
    const theirs = b[key];

    if (isEventHandlerName(key) && typeof ours === "function" && typeof theirs === "function") {
      merged[key] = composeEventHandlers(
        ours as (event: SyntheticEvent) => void,
        theirs as (event: SyntheticEvent) => void,
      );
    } else if (key === "className") {
      merged[key] = cn(ours as string | undefined, theirs as string | undefined);
    } else if (key === "style") {
      merged[key] = { ...(ours as CSSProperties), ...(theirs as CSSProperties) };
    } else if (key === "ref") {
      merged[key] = mergeRefs(ours as Ref<unknown>, theirs as Ref<unknown>);
    } else if (theirs !== undefined) {
      merged[key] = theirs;
    }
  }

  return merged as MergedProps<A, B>;
}
