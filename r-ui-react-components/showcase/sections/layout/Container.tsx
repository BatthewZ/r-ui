import type { ReactNode } from "react";

import { Container, Grid, Inline, Section, Stack } from "../../../src/components/layout";
import { Button, Card } from "../../../src/components/primitives";
import { cn } from "../../../src/util/style";
import { Row } from "./parts/demo";

export const meta = {
  title: "Container and Section",
  group: "layout",
  order: 30,
  components: ["Section"],
  description:
    "Container fills its parent up to the page or reading width plus the fluid gutter, and centres there, whatever lays out the parent: a block, a Stack, an Inline or a grid cell. Section spaces marketing blocks with the fluid section rhythm; both are density-independent, so compact leaves them alone.",
};

type ParentKind = "block" | "stack" | "inline" | "grid";

const PARENTS: { kind: ParentKind; label: string }[] = [
  { kind: "block", label: "a block" },
  { kind: "stack", label: "a Stack (flex column)" },
  { kind: "inline", label: "an Inline (flex row)" },
  { kind: "grid", label: "a grid cell" },
];

function Parent({ kind, children }: { kind: ParentKind; children: ReactNode }) {
  if (kind === "stack") return <Stack gap="r3" className="bg-surface-2" data-sc-parent={kind}>{children}</Stack>;
  if (kind === "inline") return <Inline gap="r3" className="bg-surface-2" data-sc-parent={kind}>{children}</Inline>;
  if (kind === "grid") return <div className="grid gap-r3 bg-surface-2" data-sc-parent={kind}>{children}</div>;
  return <div className="bg-surface-2" data-sc-parent={kind}>{children}</div>;
}

const CARDS = [
  ["Latency budgets", "Every route gets a budget, and a deploy that breaks one waits for a second look."],
  ["Rollbacks", "One press returns the previous build, with the reason written into the log."],
  ["Audit trail", "Who shipped what, when, and which checks it passed on the way out."],
] as const;

/**
 * A Grid and a Card are size containers, so neither gives the Container any width of its
 * own. The last two pad with something other than the gutter: none plus `px-r4`, and the
 * gutter replaced by `px-r1`.
 */
const CASES = [
  { id: "page", width: "page", gutter: true, className: "" },
  { id: "measure", width: "measure", gutter: true, className: "" },
  { id: "padded", width: "page", gutter: false, className: "px-r4" },
  { id: "repadded", width: "measure", gutter: true, className: "px-r1" },
] as const;

function CardsIn({ kind }: { kind: ParentKind }) {
  return (
    <Parent kind={kind}>
      {CASES.map(({ id, width, gutter, className }) => (
        <Container key={id} width={width} gutter={gutter} className={cn("bg-surface-0", className)} data-sc-container={id}>
          <Grid columns={{ base: 1, "@xl": 2, "@3xl": 3 }}>
            {CARDS.map(([title, text]) => (
              <Card key={title}>
                <Card.Header>
                  <Card.Title>{title}</Card.Title>
                  <Card.Description>{text}</Card.Description>
                </Card.Header>
              </Card>
            ))}
          </Grid>
        </Container>
      ))}
    </Parent>
  );
}

export default function ContainerSection() {
  return (
    <Stack gap="r1">
      <Row label="Container · page · measure · full (tint: the parent; dashed: the content edge, inside the gutter)">
        <Stack gap="r3">
          {(["page", "measure", "full"] as const).map((width) => (
            <div key={width} className="bg-surface-2">
              <Container width={width} className="bg-surface-0" data-testid={`container-${width}`}>
                <div className="border-x border-dashed border-border-strong py-r4 text-body-2 text-fg-secondary">
                  width=&quot;{width}&quot;
                </div>
              </Container>
            </div>
          ))}
        </Stack>
      </Row>
      {PARENTS.map(({ kind, label }) => (
        <Row key={kind} label={`Container · page, measure, padded without the gutter, gutter re-padded · a Grid of cards in ${label}`}>
          <CardsIn kind={kind} />
        </Row>
      ))}
      <Row label="Section · plain, band, then section-3">
        <div className="overflow-hidden rounded-md border">
          <Section aria-label="Hero">
            <Container width="measure">
              <Stack gap="r3">
                <h2 className="text-display-2">Ship on a Friday.</h2>
                <p className="text-prose-1 text-fg-secondary">
                  Deploys you can watch, roll back and explain. The section rhythm and gutter are fluid; the
                  button is UI and keeps the control height.
                </p>
                <div>
                  <Button variant="primary">Start a trial</Button>
                </div>
              </Stack>
            </Container>
          </Section>
          <Section variant="band" padding="section-2" aria-label="Logos">
            <Container>
              <p className="text-center text-body-2 text-fg-secondary">Trusted by teams who page at 3am.</p>
            </Container>
          </Section>
          <Section padding="section-3" aria-label="Footer note">
            <Container>
              <p className="text-body-3 text-fg-muted">section-3: between a heading group and its content.</p>
            </Container>
          </Section>
        </div>
      </Row>
    </Stack>
  );
}
