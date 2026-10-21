import { useEffect, useState } from "react";

import { animationFrames, type FrameScheduler } from "./replay";

/** Counts the requests a view has in flight. */
export interface RequestTracker {
  readonly pending: number;
  /** `work`, counted until it settles either way. */
  track<T>(work: Promise<T>): Promise<T>;
}

export function createRequestTracker(): RequestTracker {
  let pending = 0;
  return {
    get pending() {
      return pending;
    },
    track(work) {
      pending += 1;
      return work.finally(() => {
        pending -= 1;
      });
    },
  };
}

/**
 * Frames that must pass with nothing in flight: a request answered in one
 * frame is read and rendered by the runtime over the next, and a binding's
 * request starts in an effect after the render that closed it.
 */
export const QUIET_FRAMES = 2;

/**
 * True once the document is complete and `tracker` has stayed idle for
 * QUIET_FRAMES consecutive frames; stays true for the life of the component.
 */
export function useSettled(complete: boolean, tracker: RequestTracker, schedule: FrameScheduler = animationFrames): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!complete || settled) return;
    let quiet = 0;
    let cancel = schedule(function check() {
      quiet = tracker.pending === 0 ? quiet + 1 : 0;
      if (quiet >= QUIET_FRAMES) setSettled(true);
      else cancel = schedule(check);
    });
    return () => cancel();
  }, [complete, settled, tracker, schedule]);

  return settled;
}

export const READY_ATTRIBUTE = "data-renderer-ready";
export const ERROR_ATTRIBUTE = "data-renderer-error";

/** `<html data-renderer-ready>` while `ready`; also `data-renderer-error` when the route itself failed. */
export function usePageMarkers(ready: boolean, error?: string): void {
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.setAttribute(READY_ATTRIBUTE, "");
    if (error !== undefined) root.setAttribute(ERROR_ATTRIBUTE, error);
    return () => {
      root.removeAttribute(READY_ATTRIBUTE);
      root.removeAttribute(ERROR_ATTRIBUTE);
    };
  }, [ready, error]);
}
