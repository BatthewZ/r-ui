import { ArrowRight, Flame } from "lucide-react";

import { Button, Container, Grid, Inline, Link, NavList, Section } from "../../../src";
import { href } from "../../shell/router";
import { FOOTER, LEGAL, PRODUCT } from "./content";

/** The final call to action: one band, one heading, the same two choices as the hero. */
export function CtaBand() {
  return (
    <Section variant="band" aria-labelledby="mkt-cta-title">
      <Container className="text-center">
        <h2 id="mkt-cta-title" className="mx-auto max-w-measure text-balance text-display-2 text-fg-primary">
          Your next release is already merged. Let it explain itself.
        </h2>
        <p className="mx-auto mt-[var(--PROSE-FLOW)] max-w-measure text-pretty text-prose-1 text-fg-secondary">
          Connect a repository and {PRODUCT} drafts your first release note in about a minute. Free for one
          repository, no card needed.
        </p>
        <Inline gap="r4" justify="center" className="mt-section-3">
          <Button iconEnd={<ArrowRight />}>Start free</Button>
          <Button variant="secondary">Book a demo</Button>
        </Inline>
      </Container>
    </Section>
  );
}

export function SiteFooter() {
  return (
    <Section as="footer" padding="section-2" aria-label={`${PRODUCT} site`}>
      <Container>
        <Grid columns={{ base: 2, "@2xl": 4 }} gap="r1">
          <div className="col-span-2 min-w-0 @2xl:col-span-1">
            <p className="inline-flex items-center gap-r5 text-h3 text-fg-primary">
              <Flame aria-hidden className="size-icon" />
              {PRODUCT}
            </p>
            <p className="mt-r4 max-w-measure text-body-2 text-fg-secondary">
              Release notes from the work you already did. Made by a small team in Rotterdam and Montréal.
            </p>
          </div>
          {FOOTER.map(({ title, links }) => (
            <NavList key={title} label={title}>
              <NavList.Section title={title}>
                {links.map((link) => (
                  <NavList.Item key={link} href={href("marketing")}>
                    {link}
                  </NavList.Item>
                ))}
              </NavList.Section>
            </NavList>
          ))}
        </Grid>
        <div className="mt-section-2 flex flex-wrap justify-between gap-r3 border-t border-border pt-r2 text-body-3 text-fg-muted">
          <p>© 2026 {PRODUCT} Software B.V.</p>
          <ul className="flex flex-wrap gap-x-r2 gap-y-r4" aria-label="Legal">
            {LEGAL.map((label) => (
              <li key={label}>
                <Link variant="inherit" href={href("marketing")}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
