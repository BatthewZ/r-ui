import type { Section } from "./sections";
import { SectionBoundary } from "./SectionBoundary";

/**
 * One demo section as every page that shows sections renders it (a group's
 * page, the all-sections and solo routes): anchored by its id, titled, its demo
 * in a frame behind its own error boundary. One source, so a check that runs on
 * the solo route measures the markup a group's page shows. `level` is the
 * title's heading level under the page's outline (default 3).
 */
export function SectionFrame({ section: { id, meta, Component }, level = 3 }: { section: Section; level?: 2 | 3 }) {
  const Title = `h${level}` as const;
  return (
    <section id={id} className="sc-section" aria-labelledby={`${id}-title`}>
      <header>
        <Title id={`${id}-title`}>{meta.title}</Title>
        {meta.description && <p>{meta.description}</p>}
      </header>
      <div className="sc-demo" data-sc-frame={meta.frame === "open" ? "open" : undefined}>
        <SectionBoundary title={meta.title}>
          <Component />
        </SectionBoundary>
      </div>
    </section>
  );
}
