import { Bookmark } from "lucide-react";
import { useState } from "react";

import { Badge, Card, Carousel, Container, Grid, IconButton, MediaCard, Section } from "../../../src";
import { href } from "../../shell/router";
import grid from "./art/grid.svg";
import kiln from "./art/kiln.svg";
import pages from "./art/pages.svg";
import readers from "./art/readers.svg";
import { type Post, POSTS, QUOTES } from "./content";
import { SectionHeading } from "./SectionHeading";

const ART: Record<NonNullable<Post["art"]>, string> = { grid, kiln, pages, readers };

const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long" });
/** A post's calendar date at local midnight (never parsed as a UTC instant). */
const localDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
};

/**
 * Customer quotes, one to three side by side by the carousel's width. A carousel
 * earns its place here: five short quotes in a row would crowd the page, and they
 * are equal, skippable things. No autoplay; every quote is reachable by scrolling.
 */
export function Testimonials() {
  return (
    <Section id="customers" padding="section-2" aria-labelledby="mkt-quotes-title">
      <Container>
        <SectionHeading id="mkt-quotes-title" eyebrow="Customers" title="Teams that stopped writing changelogs by hand." />
        <Carousel label="What customers say" perView={3} className="mt-section-3" data-mkt="quotes">
          {QUOTES.map(({ quote, name, role, company }) => (
            <Carousel.Slide key={name} className="flex">
              <Card className="flex-1 px-r2">
                <figure className="flex h-full flex-col gap-r2">
                  <blockquote className="text-pretty text-prose-2 text-fg-primary">&ldquo;{quote}&rdquo;</blockquote>
                  <figcaption className="mt-auto text-body-2 text-fg-secondary">
                    <span className="font-medium text-fg-primary">{name}</span>, {role} at {company}
                  </figcaption>
                </figure>
              </Card>
            </Carousel.Slide>
          ))}
        </Carousel>
      </Container>
    </Section>
  );
}

/** "From the journal": the essay above is one of these; the rest are a grid of whole-card links. */
export function JournalGrid() {
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());
  const toggle = (slug: string) =>
    setSaved((prev) => {
      const next = new Set(prev);
      if (!next.delete(slug)) next.add(slug);
      return next;
    });

  return (
    <Section padding="section-2" aria-labelledby="mkt-posts-title" data-mkt="posts">
      <Container>
        <SectionHeading id="mkt-posts-title" eyebrow="Journal" title="More from the journal." />
        <Grid as="ul" columns={{ base: 1, "@xl": 2, "@5xl": 4 }} gap="r2" className="mt-section-3">
          {POSTS.map((post) => {
            const date = localDate(post.date);
            return (
              <li key={post.slug} className="flex min-w-0">
                <MediaCard
                  className="flex-1"
                  href={href("marketing", "journal")}
                  title={post.title}
                  description={post.description}
                  image={post.art && { src: ART[post.art], alt: "", width: 1600, height: 900 }}
                  badge={post.kind && <Badge variant="solid">{post.kind}</Badge>}
                  meta={
                    <>
                      {post.author} · <time dateTime={post.date}>{day.format(date)}</time> · {post.minutes} min read
                    </>
                  }
                  actions={
                    <IconButton
                      label={`Save “${post.title}” for later`}
                      icon={<Bookmark />}
                      aria-pressed={saved.has(post.slug)}
                      onClick={() => toggle(post.slug)}
                    />
                  }
                />
              </li>
            );
          })}
        </Grid>
      </Container>
    </Section>
  );
}
