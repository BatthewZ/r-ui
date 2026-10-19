import { ArrowRight } from "lucide-react";

import { Badge, Button, Card, formatNumber, Hero, Inline, LogoCloud, Stack, useLocale } from "../../../src";
import { IMAGE_LOGOS, INLINE_LOGOS } from "../../sections/marketing/parts/logos";
import { href } from "../../shell/router";
import { PRODUCT, STATS } from "./content";

const TEAMS = STATS.find((s) => s.id === "teams")!.value;

/**
 * The library's Hero, split: the text on the start side and the release
 * preview beside it once the hero is wide, under it when narrow; the customer
 * logos run under both. The top padding clears the transparent site header
 * that overlaps it.
 */
export function PageHero() {
  const locale = useLocale();
  return (
    <Hero
      data-mkt="hero"
      layout="split"
      className="py-section-2 pt-[calc(var(--r-marketing-site-header-h)+var(--SECTION-2))]"
      eyebrow={
        <a
          href={href("marketing", "journal")}
          className="inline-flex min-h-hit items-center gap-r5 text-fg-accent hover:underline"
        >
          New: why nobody reads your changelog
          <ArrowRight aria-hidden className="size-icon rtl:-scale-x-100" />
        </a>
      }
      title="Release notes your customers actually read."
      lead={
        <>
          {PRODUCT} drafts a changelog from the pull requests you already merged, sorts every change by who it
          affects, and publishes it to your docs, your app and your customers&rsquo; inboxes. You edit a sentence or
          two, and ship.
        </>
      }
      actions={
        <>
          <Button iconEnd={<ArrowRight />}>Start free</Button>
          <Button variant="secondary">Book a demo</Button>
        </>
      }
      media={<ReleasePreview locale={locale} />}
      proof={
        <LogoCloud marquee title={`Writing release notes for ${formatNumber(TEAMS, { locale })} product teams, including`}>
          {INLINE_LOGOS}
          {IMAGE_LOGOS}
        </LogoCloud>
      }
    />
  );
}

/** The one confident visual: a release note as a customer sees it. */
function ReleasePreview({ locale }: { locale: string | undefined }) {
  const published = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(2026, 9, 14));
  return (
    <figure className="min-w-0">
      <Card className="gap-r2">
        <Stack gap="r3" className="px-r2">
          <Inline gap="r4" className="text-body-2 text-fg-muted">
            <Badge variant="outline">v4.2</Badge>
            <span>Published {published}</span>
          </Inline>
          <p className="text-balance text-display-4 text-fg-primary">Exports are faster, and you can schedule them</p>
        </Stack>
        <Card.Body>
          <dl className="grid gap-r3">
            {[
              ["New", "Schedule any export to run daily or weekly, and get the file by email."],
              ["Improved", "Large CSV exports finish in about six seconds, down from forty."],
              ["Fixed", "Dates in exported files now follow your workspace time zone."],
            ].map(([kind, text]) => (
              <div key={kind} className="grid gap-r6">
                <dt className="text-body-3 font-medium text-fg-muted">{kind}</dt>
                <dd className="text-body-1 text-fg-primary">{text}</dd>
              </div>
            ))}
          </dl>
        </Card.Body>
        <Card.Footer className="justify-between text-body-3 text-fg-muted">
          <span>Drafted from 23 pull requests</span>
          <span>Approved by Maya Okafor</span>
        </Card.Footer>
      </Card>
      <figcaption className="mt-r4 text-body-3 text-fg-muted">A release note drafted by {PRODUCT}, as your customers see it.</figcaption>
    </figure>
  );
}
