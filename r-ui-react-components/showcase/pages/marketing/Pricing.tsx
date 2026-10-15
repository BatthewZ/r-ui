import { ArrowRight, Check, Minus } from "lucide-react";

import { Badge, Button, cn, Container, Inline, Section, Table } from "../../../src";
import { type Plan, PLAN_ROWS, type PlanValue, PLANS } from "./content";
import { SectionHeading } from "./SectionHeading";

/**
 * The plan columns share the room the feature column leaves; their short values
 * wrap (`wrap` cells), so three plans fit beside the features in a phone-wide table.
 */
const PLAN_COLUMN = "w-1/5 px-r5 text-center last:pe-r5";

const price = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function Pricing() {
  return (
    <Section id="pricing" aria-labelledby="mkt-pricing-title">
      <Container>
        <SectionHeading
          id="mkt-pricing-title"
          eyebrow="Pricing"
          title="Pay for the people who write. Reading is free."
          lead="Every plan publishes to unlimited readers. Upgrade when you want review before publishing, more channels, or single sign-on."
        />
        <Table variant="rules" aria-label="Plans compared" className="mt-section-3">
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell wrap>
                <span className="sr-only">Feature</span>
              </Table.HeaderCell>
              {PLANS.map((plan) => (
                <Table.HeaderCell key={plan.id} wrap className={cn(PLAN_COLUMN, "py-r2 align-bottom")}>
                  <PlanHead plan={plan} />
                </Table.HeaderCell>
              ))}
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {PLAN_ROWS.map(({ feature, values }) => (
              <Table.Row key={feature}>
                <Table.HeaderCell scope="row" wrap className="py-r4 pe-r5 text-body-1 font-normal text-fg-primary">
                  {feature}
                </Table.HeaderCell>
                {PLANS.map((plan) => (
                  <Table.Cell key={plan.id} wrap className={PLAN_COLUMN}>
                    <PlanCell value={values[plan.id]} />
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        <Inline gap="r4" justify="between" className="mt-section-3">
          <p className="max-w-measure text-pretty text-prose-3 text-fg-secondary">
            Every paid plan starts with 14 days of Team, free. Prices exclude VAT.
          </p>
          <Inline gap="r4">
            <Button iconEnd={<ArrowRight />}>Start free</Button>
            <Button variant="secondary">Talk to us about Business</Button>
          </Inline>
        </Inline>
      </Container>
    </Section>
  );
}

function PlanHead({ plan }: { plan: Plan }) {
  return (
    <span className="inline-grid justify-items-center gap-r6">
      {plan.recommended && <Badge tone="accent">Popular</Badge>}
      <span className="text-body-1 font-semibold text-fg-primary">{plan.name}</span>
      <span className="text-display-3 text-fg-primary">{plan.price === 0 ? "Free" : price.format(plan.price)}</span>
      <span className="text-body-3 font-normal text-fg-muted">{plan.note}</span>
    </span>
  );
}

function PlanCell({ value }: { value: PlanValue }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="inline size-icon text-fg-primary" />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus aria-hidden className="inline size-icon text-fg-muted" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-body-1">{value}</span>;
}
