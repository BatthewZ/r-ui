import type { ReactNode } from "react";

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}

/**
 * A marketing heading group: a quiet UI-scale eyebrow, a display heading and an
 * optional lead. The lead sits one prose-flow step below the heading (fluid,
 * density-independent); what follows the group starts `section-3` below it.
 * The heading is balanced rather than capped: `--MEASURE` is in `ch` of the
 * element's own font, so on display type it would not cap anything.
 */
export function SectionHeading({ id, eyebrow, title, lead }: SectionHeadingProps) {
  return (
    <header>
      <p className="text-body-2 font-medium text-fg-muted">{eyebrow}</p>
      <h2 id={id} className="mt-r4 text-balance text-display-2 text-fg-primary">
        {title}
      </h2>
      {lead && <p className="mt-[var(--PROSE-FLOW)] max-w-measure text-pretty text-prose-1 text-fg-secondary">{lead}</p>}
    </header>
  );
}
