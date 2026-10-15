"use client";
import { type AnimationEvent, useCallback, useLayoutEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "./use-reduced-motion";

/** Which half of the swap the panel currently on screen is in. */
export type PanelTransitionPhase = "enter" | "exit";

export interface UsePanelTransitionOptions {
  /** Class carried by the arriving panel. @default "fade-in" */
  enterClass?: string;
  /** Class carried by the leaving panel. @default "fade-out" */
  exitClass?: string;
}

export interface UsePanelTransitionReturn<T> {
  /**
   * The value whose panel belongs on screen right now. It lags `activeValue`
   * for the length of the exit — that lag is what makes the swap sequential
   * rather than a cross-fade, so the two panels never overlap and never fight
   * over the container's height.
   */
  renderedValue: T;
  phase: PanelTransitionPhase;
  /**
   * `enterClass` or `exitClass` for the current phase, and `undefined` under
   * reduced motion — where there is no exit to run, so no class to name.
   */
  transitionClass: string | undefined;
  /**
   * Wire to the panel's `onAnimationEnd`. Compose it rather than spreading over
   * a caller's handler, and pass `{ checkDefaultPrevented: false }`:
   * `animationend` is not cancelable, so honouring `preventDefault()` would
   * invent an opt-out that strands the leaving panel on screen forever.
   */
  onPanelAnimationEnd: (event: AnimationEvent<Element>) => void;
  /**
   * Attach to the panel element, alongside any ref of your own via `mergeRefs`.
   *
   * It is what lets the hook ask whether an exit is actually going to animate.
   * Where nothing will run, there is no exit to wait for and the swap happens
   * at once — see the note on the layout effect in this file for the two ways
   * that legitimately happens. Omit it and the swap still works; it just has to
   * take an `animationend` on trust.
   */
  panelRef: (node: HTMLElement | null) => void;
}

/**
 * Swaps one panel for another in two beats: the outgoing one leaves, and only
 * then does the incoming one mount and arrive. `Tabs` and `Wizard` both drive
 * their panels with this, so the timing is written once.
 *
 * Three rules the naive version gets wrong, each of them a shipped behaviour:
 *
 * - **A change arriving mid-exit drops the queued animation.** Someone clicking
 *   through four steps faster than the exit runs should land on the fourth, not
 *   watch a backlog drain. The newest value wins and renders at once.
 * - **Reduced motion skips the exit entirely** rather than shortening it. An
 *   exit that is merely fast still defers the mount, and deferring a mount is
 *   not motion — it is latency, which is not what the preference asked for.
 * - **`renderedValue` is the subject of everything the panel says about itself**
 *   — its key, its accessible name, the effect that moves focus to it. Reading
 *   `activeValue` for any of those announces a panel that is not on screen yet.
 *
 * The caller owns the panel element, so it owns the unmount: render exactly the
 * panel for `renderedValue`, put `transitionClass` on it, and key it by
 * `renderedValue` if its content must not reconcile across the swap.
 *
 * @example
 * const { renderedValue, transitionClass, onPanelAnimationEnd } =
 *   usePanelTransition(activeStep);
 *
 * <div key={renderedValue} className={cn(transitionClass)} onAnimationEnd={onPanelAnimationEnd}>
 *   {steps[renderedValue].content}
 * </div>
 */
export function usePanelTransition<T>(
  activeValue: T,
  { enterClass = "fade-in", exitClass = "fade-out" }: UsePanelTransitionOptions = {},
): UsePanelTransitionReturn<T> {
  const reducedMotion = usePrefersReducedMotion();

  // ONE state atom, always written through a functional updater, and both halves
  // of that are load-bearing rather than style.
  //
  // Deriving the swap during render is what makes it synchronous — the leaving
  // panel is on screen in the same commit that moved the index, with no flash of
  // the incoming one. But React may invoke a component more than once for a
  // single update and DISCARD the earlier invocations, which it does reliably on
  // the first update after mount. Two separate `useState` atoms tear when that
  // happens: an earlier version of this held `prevActive` and `exiting`
  // separately, the replay kept the first and reverted the second, and the exit
  // was dropped inside one frame — the class landed in the DOM and the browser
  // never started the animation, so the very first swap of a component's life
  // had no exit at all while every later one did. Measured in Chromium, and it
  // was shipping in `Tabs` before this hook existed.
  //
  // One atom cannot half-apply, and an updater that reads `prev` recomputes from
  // whatever React actually committed, so a replay converges on the same answer
  // instead of losing part of it. Nothing here may read `rendered`/`active` from
  // the render closure.
  const [panel, setPanel] = useState<{ rendered: T; active: T }>({
    rendered: activeValue,
    active: activeValue,
  });

  if (!Object.is(activeValue, panel.active)) {
    setPanel((prev) => {
      // Precautionary, and measured as such: React was never observed to chain
      // two queued copies of this update, and removing this line changes no
      // test and no render count. It stays because the failure it prevents is
      // silent and total — a second application would read its own output
      // (`rendered` already behind `active`) as "an exit is in progress", take
      // the skip branch, and collapse the swap it just started.
      if (Object.is(prev.active, activeValue)) return prev;
      // `prev.rendered !== prev.active` means an exit is already running. A
      // change arriving then drops the queued animation rather than draining a
      // backlog, so someone moving faster than the fade lands where they asked.
      const skip = reducedMotion || !Object.is(prev.rendered, prev.active);
      return skip
        ? { rendered: activeValue, active: activeValue }
        : { rendered: prev.rendered, active: activeValue };
    });
  }

  /**
   * End the exit, whatever ended it, by naming the value to settle on rather
   * than by undoing whatever was in flight.
   *
   * That distinction is the whole correctness of this function. Outside the
   * render loop, `prev` is the **committed base**, not the state the exit
   * render was built from — measured: a layout effect firing on the exit commit
   * receives `{ rendered: 0, active: 0 }` while the panel on screen is rendering
   * from `{ rendered: 0, active: 1 }`. A relative updater ("collapse whatever is
   * exiting") reads that base, correctly concludes nothing is exiting, and bails
   * out — so the exit it was called to end silently survives. An absolute target
   * is immune: it means the same thing from any base, and a replay that applies
   * it twice lands in the same place.
   *
   * `prev` is still read, but only to ask whether it is *already* the target,
   * which is the bail-out that keeps an `animationend` with nothing to end from
   * re-rendering the consumer.
   */
  const endExit = useCallback((settleOn: T) => {
    setPanel((prev) =>
      Object.is(prev.rendered, settleOn) && Object.is(prev.active, settleOn)
        ? prev
        : { rendered: settleOn, active: settleOn },
    );
  }, []);

  const onPanelAnimationEnd = useCallback(
    (event: AnimationEvent<Element>) => {
      // `animationend` bubbles, so a child finishing its own animation mid-exit
      // would otherwise cut the exit short.
      if (event.target !== event.currentTarget) return;
      endExit(activeValue);
    },
    [endExit, activeValue],
  );

  const isExiting = !Object.is(panel.rendered, panel.active);

  const nodeRef = useRef<HTMLElement | null>(null);
  const panelRef = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  // An exit is a wait for an animation, so where no animation is going to run
  // there is nothing to wait for and the swap belongs in this commit. Running
  // here rather than in an effect or a timer is what makes it *instant*: a
  // layout effect lands before paint, so the outgoing panel is never shown for
  // even one frame on its way out.
  //
  // Two routes reach this, both measured in Chromium rather than reasoned about:
  // a consumer stylesheet that wins with `animation: none !important`, and the
  // whole component sitting under a `display: none` ancestor when the step
  // changes. `getAnimations()` is the instrument for both — under `display:
  // none` the computed `animation-name` still reads `fade-out` while no
  // animation exists, so a computed-style check would stall exactly there.
  // A Tailwind `animate-none` on the panel is NOT one of these routes: the
  // `fade-*` classes are unlayered foundation CSS and out-rank a utility, so
  // that spelling never suppressed anything to begin with.
  //
  // The capability gate is deliberate. jsdom implements no animations and no
  // `getAnimations`, so it cannot answer the question — and "I cannot tell"
  // must mean "wait for `animationend`", which is what the tests simulate.
  // Treating it as "nothing will animate" would make every swap instant there
  // and leave the two-beat contract with no coverage at all.
  useLayoutEffect(() => {
    if (!isExiting) return;
    const node = nodeRef.current;
    if (!node || typeof node.getAnimations !== "function") return;

    // `animationName` is the tell for a CSSAnimation; a CSSTransition on the
    // same element carries `transitionProperty` instead and must not be counted
    // as the exit, or a panel that only transitions would wait for an
    // `animationend` that is never coming.
    const willAnimate = node.getAnimations().some((animation) => "animationName" in animation);
    if (!willAnimate) {
      endExit(activeValue);
      return;
    }

    // An animation that starts and is then cut short — the panel hidden
    // mid-flight — fires `animationcancel` and never `animationend`. React has
    // no synthetic event for it, hence the native listener.
    const onCancel = () => endExit(activeValue);
    node.addEventListener("animationcancel", onCancel);
    return () => node.removeEventListener("animationcancel", onCancel);
  }, [isExiting, endExit, activeValue]);

  const phase: PanelTransitionPhase = isExiting ? "exit" : "enter";

  return {
    renderedValue: panel.rendered,
    phase,
    transitionClass: reducedMotion ? undefined : isExiting ? exitClass : enterClass,
    onPanelAnimationEnd,
    panelRef,
  };
}
