import { Container, Grid, Section, Tabs } from "../../../src";
import { FAQ } from "./content";
import { SectionHeading } from "./SectionHeading";

/**
 * Questions grouped by topic under Tabs. The library has no disclosure
 * (accordion) component, so each topic shows all of its answers at once, which
 * also keeps every answer findable with the browser's own search.
 */
export function Faq() {
  const first = FAQ[0]?.id ?? "";
  return (
    <Section id="faq" padding="section-2" aria-labelledby="mkt-faq-title">
      <Container>
        <SectionHeading id="mkt-faq-title" eyebrow="Questions" title="What teams ask before they switch." />
        <Tabs defaultValue={first} className="mt-section-3 gap-section-3">
          <Tabs.List aria-label="Question topics">
            {FAQ.map(({ id, label }) => (
              <Tabs.Tab key={id} value={id}>
                {label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {FAQ.map(({ id, questions }) => (
            <Tabs.Panel key={id} value={id}>
              <Grid as="dl" minColumn="lg" gap="r1" rowGap="r1">
                {questions.map(({ q, a }) => (
                  <div key={q} className="min-w-0">
                    <dt className="text-pretty text-display-4 text-fg-primary">{q}</dt>
                    <dd className="mt-r4 max-w-measure text-pretty text-prose-2 text-fg-secondary">{a}</dd>
                  </div>
                ))}
              </Grid>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Container>
    </Section>
  );
}
