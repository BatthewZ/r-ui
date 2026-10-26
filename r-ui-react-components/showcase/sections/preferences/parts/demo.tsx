import type { ReactNode } from "react";
import { DemoLabel } from "../../../shell/DemoLabel";

/** A labelled row inside a demo. Kept in a subfolder, which the section registry does not glob. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-r5">
      <DemoLabel>{label}</DemoLabel>
      {children}
    </div>
  );
}
