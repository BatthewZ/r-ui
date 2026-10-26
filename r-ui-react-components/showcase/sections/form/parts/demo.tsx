import type { ReactNode } from "react";
import { DemoLabel } from "../../../shell/DemoLabel";

/** A labelled row inside a form demo. In a subfolder, which the section registry does not glob. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-r5">
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
      <div className="grid gap-r3 @lg:grid-cols-2 @3xl:grid-cols-3">{children}</div>
    </div>
  );
}
