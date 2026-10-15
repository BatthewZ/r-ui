import { Eye, GitMerge, type LucideIcon, PenLine, Send, ShieldCheck, Users } from "lucide-react";

import { Card, Container, Grid, Section } from "../../../src";
import { type Feature, FEATURES, PRODUCT } from "./content";
import { SectionHeading } from "./SectionHeading";

const ICONS: Record<Feature["icon"], LucideIcon> = {
  merge: GitMerge,
  audience: Users,
  edit: PenLine,
  publish: Send,
  review: ShieldCheck,
  read: Eye,
};

export function Features() {
  return (
    <Section id="features" aria-labelledby="mkt-features-title">
      <Container>
        <SectionHeading
          id="mkt-features-title"
          eyebrow="How it works"
          title="From merged to explained, before the release meeting ends."
          lead={`${PRODUCT} sits between your repository and your customers. It does the first ninety percent of the writing, so the last ten gets your full attention.`}
        />
        <Grid as="ul" minColumn="lg" gap="r2" className="mt-section-3">
          {FEATURES.map(({ icon, title, body }) => {
            const Icon = ICONS[icon];
            return (
              <li key={title} className="flex min-w-0">
                <Card className="flex-1">
                  <Card.Header>
                    <Icon aria-hidden className="size-icon text-fg-secondary" />
                    <Card.Title className="mt-r3 text-display-4">{title}</Card.Title>
                    <Card.Description className="mt-r4 text-pretty text-prose-3">{body}</Card.Description>
                  </Card.Header>
                </Card>
              </li>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}
