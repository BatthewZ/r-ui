import type { Section } from "./sections";
import { SectionBoundary } from "./SectionBoundary";

/**
 * One demo section as every page that shows sections renders it (the Overview,
 * the solo route): anchored by its id, titled, its demo in a frame behind its
 * own error boundary. One source, so a check that runs on the solo route
 * measures the markup the Overview shows.
 */
export function SectionFrame({ section: { id, meta, Component } }: { section: Section }) {
  return (
    <section id={id} className="sc-section" aria-labelledby={`${id}-title`}>
      <header>
        <h3 id={`${id}-title`}>{meta.title}</h3>
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
