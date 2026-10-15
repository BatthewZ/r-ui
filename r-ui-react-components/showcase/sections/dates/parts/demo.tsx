import type { ReactNode } from "react";

/** A labelled row inside a dates demo. In a subfolder, which the section registry does not glob. */
export function Row({ label, children, ...props }: { label: string; children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <div className="grid min-w-0 gap-r5" {...props}>
      <div className="text-body-3 font-medium text-fg-muted">{label}</div>
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

/** A fixed demo date, so the showcase and its checks never depend on the day they run. */
export const day = (month: number, date: number, year = 2026) => new Date(year, month - 1, date);

export const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
