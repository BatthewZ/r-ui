import { Carousel, Container, CountUp, formatPercent, Grid, Section, SectionHeading, Testimonial } from "../../../src";
import { PRODUCT, QUOTES, STATS } from "./content";

/**
 * Three figures, counting up once as they scroll into view (the final value is
 * what a reader without motion, and assistive tech, get), then customers in
 * their own words. A carousel earns its place
 * here: five short quotes in a row would crowd the page, and they are equal,
 * skippable things. No autoplay; every quote is reachable by scrolling.
 */
export function Customers() {
  return (
    <Section id="customers" padding="section-2" aria-labelledby="mkt-quotes-title">
      <Container>
        <SectionHeading titleId="mkt-quotes-title" eyebrow="Customers" title="Teams that stopped writing changelogs by hand." />
        <Grid as="ul" aria-label={`${PRODUCT} in numbers`} columns={{ base: 1, "@2xl": 3 }} gap="r1" className="mt-section-3">
          {STATS.map(({ id, value, percent, label }) => (
            <li key={id} className="min-w-0 border-t border-border pt-r3">
              <p className="text-display-2 text-fg-primary">
                <CountUp value={value} format={percent ? percentText : undefined} />
              </p>
              <p className="mt-r5 max-w-measure text-pretty text-prose-3 text-fg-secondary">{label}</p>
            </li>
          ))}
        </Grid>
        <Carousel label="What customers say" perView={3} className="mt-section-2" data-mkt="quotes">
          {QUOTES.map(({ quote, name, role, company }) => (
            <Carousel.Slide key={name} className="flex">
              <Testimonial className="flex-1" quote={quote} name={name} role={role} company={company} />
            </Carousel.Slide>
          ))}
        </Carousel>
      </Container>
    </Section>
  );
}

const percentText = (n: number, locale: string | undefined) => formatPercent(n, { locale, maximumFractionDigits: 0 });
