import { ArrowRight, Flame } from "lucide-react";
import { type SubmitEvent, useId, useState } from "react";

import { Badge, Button, Card, Container, Hero, Inline, Input, Stack } from "../../../src";
import { href } from "../../shell/router";
import { CUSTOMERS, NAV, PRODUCT } from "./content";

/** The product's own top bar: wordmark, section links (dropped when the page is narrow), sign in. */
export function SiteHeader() {
  return (
    <Container as="header" className="flex items-center justify-between gap-r3 pt-r2">
      <a href={href("marketing")} className="inline-flex min-h-hit items-center gap-r5 text-h3 text-fg-primary">
        <Flame aria-hidden className="size-icon" />
        {PRODUCT}
      </a>
      <nav aria-label={PRODUCT} className="@max-2xl:hidden">
        <ul className="flex items-center gap-r1">
          {NAV.map(({ anchor, label }) => (
            <li key={anchor}>
              <a
                href={href("marketing", anchor)}
                className="inline-flex min-h-hit items-center text-body-1 text-fg-secondary hover:text-fg-primary"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Button variant="ghost">Sign in</Button>
    </Container>
  );
}

/**
 * The library's Hero, split: the text on the start side and the release preview
 * beside it once the hero is wide, under it when narrow. The eyebrow is a link
 * (UI scale), the sign-up form rides in the text column as the hero's children.
 */
export function PageHero() {
  return (
    <Hero
      data-mkt="hero"
      layout="split"
      className="py-section-2"
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
      media={<ReleasePreview />}
      proof={<Proof />}
    >
      <GuideSignup />
    </Hero>
  );
}

/** The email capture: one field, one button, and an answer in place of the form once sent. */
function GuideSignup() {
  const id = useId();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    setSentTo(typeof email === "string" ? email : "");
  };

  return (
    <div className="mt-section-3 max-w-measure border-t border-border pt-r2" aria-live="polite">
      {sentTo === null ? (
        <form onSubmit={submit}>
          <label htmlFor={id} className="text-body-2 text-fg-secondary">
            Not ready to connect a repository? Get our field guide to release notes. One email, no sequence.
          </label>
          <div className="mt-r4 flex flex-wrap gap-r5">
            <Input
              id={id}
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="min-w-0 flex-1 basis-column-sm"
            />
            <Button type="submit" variant="secondary">
              Send me the guide
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-body-2 text-fg-secondary">
          Sent. The guide is on its way to <span className="font-medium text-fg-primary">{sentTo}</span>.
        </p>
      )}
    </div>
  );
}

/** The one confident visual: a release note as a customer sees it. */
function ReleasePreview() {
  return (
    <figure className="min-w-0">
      <Card className="gap-r2">
        <Stack gap="r3" className="px-r2">
          <Inline gap="r4" className="text-body-2 text-fg-muted">
            <Badge variant="outline">v4.2</Badge>
            <span>Published 14 October</span>
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

/** Social proof, said quietly: muted wordmarks in the UI face, no logos, no colour. */
function Proof() {
  return (
    <div>
      <p className="text-body-2 text-fg-muted">Writing release notes for 1,400 product teams, including</p>
      <ul className="mt-r3 flex flex-wrap gap-x-r1 gap-y-r4" aria-label="Customers">
        {CUSTOMERS.map((name) => (
          <li key={name} className="text-h3 text-fg-muted">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
