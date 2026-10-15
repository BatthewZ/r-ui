import type { ReactNode } from "react";

/** A labelled row inside an overlays demo. Kept in a subfolder, which the section registry does not glob. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-r5">
      <div className="text-body-3 font-medium text-fg-muted">{label}</div>
      {children}
    </div>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-r2">{children}</div>;
}

/** A visible frame that clips (`overflow: hidden`): floating panels opened inside must still escape it. */
export function ClipFrame({ label, children, ...props }: { label: string; children: ReactNode } & Record<string, unknown>) {
  return (
    <div
      {...props}
      className="flex h-[calc(var(--CONTROL-H)*2)] items-center gap-r4 overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-1 px-r3"
    >
      <span className="text-body-3 text-fg-muted">{label}</span>
      {children}
    </div>
  );
}
