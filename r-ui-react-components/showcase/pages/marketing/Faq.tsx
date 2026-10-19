import { Accordion, Container, Grid, ScrollReveal, Section, SectionHeading } from "../../../src";
import { FAQ } from "./content";

/**
 * Questions grouped by topic, each topic an Accordion of its own (one answer
 * open at a time), beside the heading on a wide page and under it on a narrow
 * one. The questions are `h4`s under each topic's `h3`, so a screen reader's
 * heading list reads as the page's outline. The rows are controls, so they stay
 * on the UI scale (UI inside a marketing page stays UI): the question takes the
 * in-app heading size it is, the answer body text.
 */
export function Faq() {
  return (
    <Section id="faq" padding="section-2" aria-labelledby="mkt-faq-title">
      <Container>
        <Grid minColumn="lg" gap="r1" rowGap="r1" className="items-start">
          <SectionHeading titleId="mkt-faq-title" eyebrow="Questions" title="What teams ask before they switch." />
          <ScrollReveal className="flex min-w-0 flex-col gap-r1">
            {FAQ.map(({ id, label, questions }) => (
              <div key={id} className="min-w-0">
                <h3 className="text-body-2 font-medium text-fg-muted">{label}</h3>
                <Accordion headingLevel={4} className="mt-r4">
                  {questions.map(({ q, a }) => (
                    <Accordion.Item key={q} value={q}>
                      <Accordion.Trigger className="px-0 text-h3">{q}</Accordion.Trigger>
                      <Accordion.Content classNames={{ body: "max-w-measure px-0 text-pretty" }}>
                        {a}
                      </Accordion.Content>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            ))}
          </ScrollReveal>
        </Grid>
      </Container>
    </Section>
  );
}
