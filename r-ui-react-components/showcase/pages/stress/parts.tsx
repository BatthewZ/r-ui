import { type ReactNode, useEffect, useRef, useState } from "react";

import { SectionBoundary } from "../../shell/SectionBoundary";

/**
 * One stress case: a title, the one-line claim it proves, and the demo behind
 * its own error boundary (a tripped one is `[data-section-error]`, which the
 * browser checks count).
 */
export function Panel({ id, title, proves, children }: { id: string; title: string; proves: string; children: ReactNode }) {
  return (
    <section id={id} className="sc-section" aria-labelledby={`${id}-title`} data-stress-panel={id}>
      <header>
        <h2 id={`${id}-title`}>{title}</h2>
        <p>
          <span className="font-semibold text-fg-primary">Proves: </span>
          {proves}
        </p>
      </header>
      <div className="sc-demo">
        <SectionBoundary title={title}>{children}</SectionBoundary>
      </div>
    </section>
  );
}

/** A small muted label over a sub-case. */
export function Case({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ?? "flex min-w-0 flex-col gap-r4"}>
      <p className="text-body-3 font-medium text-fg-muted">{label}</p>
      {children}
    </div>
  );
}

/**
 * A hostile case the LIBRARY does not survive yet, kept as a live repro. Its
 * overflow is contained in its own scroll box so the rest of the page stays
 * measurable; `stress-matrix.js` asserts it still reproduces, so fixing the
 * library turns the check red until the case moves out of here.
 */
export function KnownBug({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div data-known-bug={id} className="flex min-w-0 flex-col gap-r4 rounded-lg border border-dashed border-status-error p-r3">
      <p className="text-body-3 font-medium text-fg-error">Library bug (reported): {title}</p>
      <div data-known-bug-box className="max-h-[calc(var(--ROW-H)*6)] min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}

const READ = ["--ROW-H", "--CONTROL-H"] as const;

/**
 * The derived tokens as resolved AT this element, re-read whenever an axis
 * attribute changes anywhere in the document. It makes a density boundary
 * visible in a screenshot; the browser checks measure the real boxes.
 */
export function TokenReadout({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const css = getComputedStyle(el);
      setText(READ.map((t) => `${t.slice(2)} ${css.getPropertyValue(t).trim()}`).join(" · "));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-density", "data-input", "data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return (
    <span ref={ref} data-readout className={className ?? "font-mono text-body-3 text-fg-muted"}>
      {text}
    </span>
  );
}
