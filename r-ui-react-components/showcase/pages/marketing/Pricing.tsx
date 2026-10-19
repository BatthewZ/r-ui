import { Container, Pricing, PricingTable, Section, SectionHeading } from "../../../src";
import { GROUPS, PLANS } from "../../sections/marketing/parts/pricing-data";

/** The plans as cards with the billing toggle, then every feature compared. */
export function PricingSection() {
  return (
    <Section id="pricing" aria-labelledby="mkt-pricing-title">
      <Container>
        <SectionHeading
          titleId="mkt-pricing-title"
          eyebrow="Pricing"
          title="Pay for the people who write. Reading is free."
          lead="Every plan publishes to unlimited readers. Upgrade when you want review before publishing, more channels, or single sign-on."
        />
        <Pricing plans={PLANS} currency="USD" className="mt-section-2" />
        <p className="mt-section-3 text-center text-body-2 text-fg-muted">Prices are per editor and exclude VAT.</p>
        <h3 id="compare" className="mt-section-1 text-balance text-display-3 text-fg-primary">
          Compare every feature
        </h3>
        <PricingTable plans={PLANS} groups={GROUPS} aria-labelledby="compare" className="mt-section-3" />
      </Container>
    </Section>
  );
}
