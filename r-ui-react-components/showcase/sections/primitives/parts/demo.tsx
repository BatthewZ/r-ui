import type { ReactNode } from "react";
import { DemoLabel } from "../../../shell/DemoLabel";

/** A labelled row inside a primitives demo. Kept in a subfolder, which the section registry does not glob. */
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
