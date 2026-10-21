import { useEffect, useState } from "react";

import { requestFrame } from "../src/stream/use-view-spec-stream";

/** Runs `callback` on a later frame; returns its cancel. */
export type FrameScheduler = (callback: () => void) => () => void;

export const animationFrames: FrameScheduler = requestFrame;

/**
 * How much of `text` shows after the next frame, from `shown`: `charsPerFrame`
 * more (all of it at 0), never ending between the halves of a surrogate pair.
 */
export function nextReplayLength(text: string, shown: number, charsPerFrame: number): number {
  if (charsPerFrame <= 0) return text.length;
  let end = Math.min(text.length, shown + charsPerFrame);
  const last = text.charCodeAt(end - 1);
  if (end < text.length && last >= 0xd800 && last <= 0xdbff) end += 1;
  return end;
}

export interface Replay {
  readonly text: string;
  /** True with the last push, as a stream that has ended. */
  readonly complete: boolean;
}

interface Progress {
  readonly source: string;
  readonly rate: number;
  readonly length: number;
}

/**
 * `text` replayed as a stream: `charsPerFrame` characters per frame, one push
 * each, from nothing. `null` passes `text` through, complete. A replay runs
 * once per mount (and per text and rate): remount to replay again.
 */
export function useReplay(text: string, charsPerFrame: number | null, schedule: FrameScheduler = animationFrames): Replay {
  const [progress, setProgress] = useState<Progress | undefined>(undefined);

  useEffect(() => {
    if (charsPerFrame === null) return;
    let length = 0;
    let cancel = schedule(function step() {
      length = nextReplayLength(text, length, charsPerFrame);
      setProgress({ source: text, rate: charsPerFrame, length });
      if (length < text.length) cancel = schedule(step);
    });
    return () => cancel();
  }, [text, charsPerFrame, schedule]);

  if (charsPerFrame === null) return { text, complete: true };
  const current = progress !== undefined && progress.source === text && progress.rate === charsPerFrame;
  const length = current ? progress.length : 0;
  return { text: text.slice(0, length), complete: current && length === text.length };
}
