import { useEffect, useState } from "react";

import { Button, Card } from "../../../src/components/primitives";
import { ProgressBar } from "../../../src/components/feedback";
import { LocaleProvider } from "../../../src/util/locale";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "ProgressBar",
  group: "feedback",
  order: 10,
  description:
    "Work toward done (role=progressbar), not a Meter's measured value. The visible value and aria-valuetext are one string: a locale percentage that never rounds up, steps when segmented, or the indeterminate word. Indeterminate sweeps, and stands still as stripes under reduced motion. A status tone adds its glyph and its spoken word.",
};

interface Upload {
  name: string;
  /** Percent per tick; 0 queues it (indeterminate) until the one before it is done. */
  rate: number;
  failAt?: number;
}

const UPLOADS: Upload[] = [
  { name: "q3-board-deck.pdf", rate: 9 },
  { name: "customer-interviews-transcripts-final-v7-reviewed.docx", rate: 6 },
  { name: "warehouse-export.csv", rate: 4, failAt: 62 },
  { name: "logo.svg", rate: 0 },
];

/** Advances every running upload each tick until each is done or has failed; Restart starts over. */
function UploadList() {
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState<number[]>(() => UPLOADS.map(() => 0));
  useEffect(() => {
    setProgress(UPLOADS.map(() => 0));
    const timer = window.setInterval(() => {
      setProgress((current) => {
        const next = current.map((value, i) => {
          const upload = UPLOADS[i]!;
          if (upload.failAt !== undefined && value >= upload.failAt) return value;
          const rate = upload.rate || (current[0]! >= 100 ? 12 : 0);
          return Math.min(100, value + rate);
        });
        if (next.every((value, i) => value === current[i])) window.clearInterval(timer);
        return next;
      });
    }, 300);
    return () => window.clearInterval(timer);
  }, [run]);

  return (
    <Card data-sc="progress-uploads">
      <Card.Header>
        <Card.Title>Uploads</Card.Title>
        <Card.Actions>
          <Button variant="secondary" onClick={() => setRun((r) => r + 1)}>
            Restart
          </Button>
        </Card.Actions>
      </Card.Header>
      <Card.Body className="grid gap-r3 pb-r2">
        {UPLOADS.map((upload, i) => {
          const value = progress[i]!;
          const failed = upload.failAt !== undefined && value >= upload.failAt;
          const queued = upload.rate === 0 && value === 0;
          return (
            <ProgressBar
              key={upload.name}
              label={upload.name}
              value={queued ? null : value}
              tone={failed ? "error" : value >= 100 ? "success" : "accent"}
              labels={{ indeterminate: "Waiting" }}
              valueText={failed ? `Failed at ${value}%` : undefined}
            />
          );
        })}
      </Card.Body>
    </Card>
  );
}

const STEPS = ["Build", "Test", "Package", "Deploy", "Verify"];

/** A job of five steps, each filling in turn; the value text names the step. */
function Pipeline() {
  const [done, setDone] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setDone(0);
    const timer = window.setInterval(() => {
      setDone((d) => {
        const next = Math.min(STEPS.length, Math.round((d + 0.25) * 100) / 100);
        if (next >= STEPS.length) window.clearInterval(timer);
        return next;
      });
    }, 350);
    return () => window.clearInterval(timer);
  }, [run]);
  const current = Math.min(STEPS.length - 1, Math.floor(done));
  const finished = done >= STEPS.length;

  return (
    <div className="grid gap-r3" data-sc="progress-pipeline">
      <ProgressBar
        variant="segmented"
        label="Release 4.2.0"
        max={STEPS.length}
        value={done}
        tone={finished ? "success" : "accent"}
        valueText={finished ? "Released" : `Step ${current + 1} of ${STEPS.length} · ${STEPS[current]}`}
      />
      <ProgressBar
        variant="segmented"
        label="Release 4.1.9"
        max={STEPS.length}
        value={1}
        tone="error"
        valueText="Failed at step 2 of 5 · Test"
      />
      <ProgressBar variant="segmented" label="Nightly backup (12 shards)" max={12} value={7} />
      <div>
        <Button variant="secondary" onClick={() => setRun((r) => r + 1)}>
          Run again
        </Button>
      </div>
    </div>
  );
}

export default function ProgressBarSection() {
  return (
    <Stack>
      <Row label="An upload list: running, a long name that wraps, a failure (error tone + glyph), a queued file (indeterminate)">
        <UploadList />
      </Row>

      <Row label="Segmented: a job's steps (the value names the step), a failed run, many steps">
        <Pipeline />
      </Row>

      <Row label="States: empty · part · done · indeterminate · warning · neutral · custom value text · no visible value">
        <div className="grid gap-r3 @2xl:grid-cols-2">
          <ProgressBar label="Not started" value={0} />
          <ProgressBar label="Indexing documents" value={45} data-sc="progress-static" />
          <ProgressBar label="Backup complete" value={100} tone="success" />
          <ProgressBar label="Preparing export" data-sc="progress-indeterminate" />
          <ProgressBar label="Storage migration (slow disk)" value={71} tone="warning" />
          <ProgressBar label="Reading catalogue" value={30} tone="neutral" />
          <ProgressBar label="Video upload" value={32} valueText="3.2 of 10 MB" />
          <ProgressBar label="Quiet bar, name only" value={58} showValue={false} />
        </div>
      </Row>

      <Row label="Inline (hideLabel), as in a table row · compact · locale de-DE · RTL">
        <div className="grid gap-r3 @2xl:grid-cols-2">
          <div className="flex min-w-0 items-center gap-r4 text-body-2">
            <span className="min-w-0 flex-1 truncate">invoices-2026-10.zip</span>
            <ProgressBar hideLabel label="invoices-2026-10.zip" value={63} className="w-1/2" />
          </div>
          <div data-density="compact" className="grid gap-r4">
            <ProgressBar label="Compact: re-derives inside" value={40} />
            <ProgressBar label="Compact, indeterminate" />
          </div>
          <LocaleProvider locale="de-DE">
            <ProgressBar label="Synchronisierung der Kontakte" value={87.5} />
          </LocaleProvider>
          <div dir="rtl">
            <ProgressBar
              label="رفع الملفات"
              value={35}
              labels={{ indeterminate: "قيد التنفيذ" }}
              locale="ar-EG"
            />
            <ProgressBar
              label="جارٍ التحضير"
              labels={{ indeterminate: "قيد التنفيذ" }}
              className="mt-r4"
              data-sc="progress-indeterminate-rtl"
            />
          </div>
        </div>
      </Row>
    </Stack>
  );
}
