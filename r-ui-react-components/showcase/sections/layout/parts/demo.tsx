import type { ReactNode } from "react";

/** A labelled row inside a demo. Kept in a subfolder, which the section registry does not glob. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-r5">
      <div className="text-body-3 font-medium text-fg-muted">{label}</div>
      {children}
    </div>
  );
}
