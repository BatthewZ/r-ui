import { act } from "@testing-library/react";

import type { FrameScheduler } from "./replay";

/** A frame scheduler the test advances by hand, one frame per `next()`. */
export function manualFrames() {
  let queue: (() => void)[] = [];
  const schedule: FrameScheduler = (callback) => {
    queue.push(callback);
    return () => {
      queue = queue.filter((queued) => queued !== callback);
    };
  };
  return {
    schedule,
    get waiting() {
      return queue.length;
    },
    next() {
      const due = queue;
      queue = [];
      act(() => {
        for (const callback of due) callback();
      });
    },
  };
}
