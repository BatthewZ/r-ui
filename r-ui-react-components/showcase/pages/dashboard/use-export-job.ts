import { useEffect, useRef, useState } from "react";

/** A CSV export, one service at a time. */
export interface ExportJob {
  done: number;
  total: number;
}

/** One service per tick: long enough to watch, short enough not to wait for. */
const TICK_MS = 150;

/**
 * The specimen's stand-in for a server-side export: `start` runs one job
 * (a new start replaces it), `cancel` drops it, and `onDone` is called once
 * the last service is written. Every timer is cleared on unmount.
 */
export function useExportJob(onDone: (total: number) => void) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const stop = () => window.clearInterval(timer.current);

  useEffect(() => {
    const interval = timer;
    return () => window.clearInterval(interval.current);
  }, []);

  const start = (total: number) => {
    stop();
    if (total <= 0) return;
    let done = 0;
    setJob({ done, total });
    timer.current = window.setInterval(() => {
      done += 1;
      if (done < total) return setJob({ done, total });
      stop();
      setJob(null);
      onDone(total);
    }, TICK_MS);
  };

  const cancel = () => {
    stop();
    setJob(null);
  };

  return { job, start, cancel };
}
