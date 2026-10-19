import { Eye, FileInput, KeyRound, type LucideIcon, PenLine, Send, SpellCheck } from "lucide-react";

import {
  Container,
  FeatureGrid,
  FeatureRows,
  HowItWorks,
  Image,
  Parallax,
  Section,
  SectionHeading,
  Spotlight,
} from "../../../src";
import { ART, ART_SIZE } from "./art";
import { type Detail, DETAILS, PRODUCT, ROWS, STEPS } from "./content";

/**
 * What the product does: three rows, each a claim beside its illustration. The
 * illustrations (decorative, `alt=""`) drift a little slower than the page; the
 * text never rides in the parallax layer.
 */
export function Features() {
  return (
    <Section id="features" aria-labelledby="mkt-features-title">
      <Container>
        <SectionHeading
          titleId="mkt-features-title"
          eyebrow="Product"
          title="From merged to explained, before the release meeting ends."
          lead={`${PRODUCT} sits between your repository and your customers. It does the first ninety percent of the writing, so the last ten gets your full attention.`}
        />
        <FeatureRows className="mt-section-2">
          {ROWS.map(({ eyebrow, title, body, art }) => (
            <FeatureRows.Row
              key={art}
              eyebrow={eyebrow}
              title={title}
              media={
                <Parallax strength="subtle" className="aspect-4/3 w-full rounded-lg">
                  <Image src={ART[art]} alt="" {...ART_SIZE} ratio="fill" radius="none" />
                </Parallax>
              }
            >
              {body}
            </FeatureRows.Row>
          ))}
        </FeatureRows>
      </Container>
    </Section>
  );
}

/** Getting started, as numbered steps on a band. */
export function Steps() {
  return (
    <Section id="how-it-works" variant="band" aria-labelledby="mkt-steps-title">
      <Container>
        <SectionHeading titleId="mkt-steps-title" eyebrow="How it works" title="Three steps, and you already do the second." />
        <HowItWorks className="mt-section-2">
          {STEPS.map(({ title, body }) => (
            <HowItWorks.Step key={title} title={title}>
              {body}
            </HowItWorks.Step>
          ))}
        </HowItWorks>
      </Container>
    </Section>
  );
}

const ICONS: Record<Detail["icon"], LucideIcon> = {
  publish: Send,
  read: Eye,
  edit: PenLine,
  style: SpellCheck,
  sso: KeyRound,
  import: FileInput,
};

/** The smaller features, as a grid of cards; a soft spotlight follows a mouse across each. */
export function Details() {
  return (
    <Section padding="section-2" aria-labelledby="mkt-details-title">
      <Container>
        <SectionHeading titleId="mkt-details-title" eyebrow="And the rest" title="The details that come up in the second meeting." />
        <FeatureGrid variant="card" className="mt-section-3">
          {DETAILS.map(({ icon, title, body }) => {
            const Icon = ICONS[icon];
            return (
              <Spotlight as={FeatureGrid.Item} key={title} icon={<Icon />} title={title}>
                {body}
              </Spotlight>
            );
          })}
        </FeatureGrid>
      </Container>
    </Section>
  );
}
