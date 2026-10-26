import type { ReactNode } from "react";

import { Sparkline } from "../../../src";
import { series } from "./fixtures";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "Sparkline",
  group: "data",
  order: 50,
  description:
    "A word-sized trend line in the entity's series colour; the latest segment and point are emphasised. role=img, named by its label plus a spoken low/high/latest summary. Gaps (null) break the line.",
};

export default function SparklineSection() {
  return (
    <div className="grid grid-cols-1 gap-r2 @xl:grid-cols-2">
      <Demo title="Series 1–4">
        {([1, 2, 3, 4] as const).map((s) => (
          <Sparkline key={s} series={s} label={`Series ${s}`} values={series(s * 7, 32, 50, 20)} />
        ))}
      </Demo>
      <Demo title="Gaps, flat, a single point, no data">
        <Sparkline label="With gaps" values={[4, 6, 5, null, null, 7, 9, 8, null, 10, 12]} />
        <Sparkline label="Flat" values={[3, 3, 3, 3, 3, 3]} />
        <Sparkline label="One point" values={[42]} />
        <Sparkline label="Empty" values={[]} />
      </Demo>
      <Demo title="Inline, in a sentence">
        <p className="text-body-1 text-fg-secondary">
          Checkout traffic{" "}
          <Sparkline
            label="Checkout requests, 12h"
            values={series(9, 12, 30, 12)}
            className="inline-block h-(--BodyText-1-line-height) w-[calc(var(--ICON)*5)] align-middle"
          />{" "}
          is back to normal.
        </p>
      </Demo>
    </div>
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <DemoLabel>{title}</DemoLabel>
      {children}
    </div>
  );
}
