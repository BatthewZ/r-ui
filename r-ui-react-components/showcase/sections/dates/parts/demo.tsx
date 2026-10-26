import type { ReactNode } from "react";
import { DemoLabel } from "../../../shell/DemoLabel";

/** A labelled row inside a dates demo. In a subfolder, which the section registry does not glob. */
export function Row({ label, children, ...props }: { label: string; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <div className="grid min-w-0 gap-r5" {...props}>
      <DemoLabel>{label}</DemoLabel>
      {children}
    </div>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-r2">{children}</div>;
}

/** Side-by-side cells that stack when the demo is narrow (container, not viewport). */
export function Grid({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid gap-r3 @lg:grid-cols-2">{children}</div>
    </div>
  );
}

/** Fields side by side, each at least --COLUMN-SM. A Field is a size container (no
 * intrinsic width), so it needs a track that gives it one, never a bare flex row. */
export const CELLS = "grid gap-r3 grid-cols-[repeat(auto-fit,minmax(min(100%,var(--COLUMN-SM)),1fr))]";

export function Cells({ children }: { children: ReactNode }) {
  return <div className={CELLS}>{children}</div>;
}

/** A fixed demo date, so the showcase and its checks never depend on the day they run. */
export const day = (month: number, date: number, year = 2026) => new Date(year, month - 1, date);

export const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
