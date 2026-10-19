import { Bookmark } from "lucide-react";
import { type SubmitEvent, useId, useState } from "react";

import {
  Badge,
  Button,
  Container,
  Grid,
  IconButton,
  Image,
  MediaCard,
  Prose,
  ReadingProgress,
  Section,
  SectionHeading,
  Select,
  useLocale,
} from "../../../src";
import { href } from "../../shell/router";
import { ART, ART_SIZE } from "./art";
import { POSTS, PRODUCT, SAMPLE_REPOS } from "./content";

/**
 * A long-form excerpt on the prose scale, with a figure and a small form in its
 * flow. The form is NOT a `.not-prose` island: the region sets no font size of
 * its own, so the Select and Button keep the UI scale (control height, UI
 * leading) with no help. `scripts/browser/marketing-page.js` measures exactly that.
 * A reading bar sticks under the showcase's top bar while the essay is in view.
 */
export function Journal() {
  return (
    <Section id="journal" variant="band" aria-labelledby="mkt-journal-title">
      <Container>
        {/* The bar spans the essay's own column, under the showcase's bar. */}
        <ReadingProgress as="article" className="mx-auto max-w-measure" classNames={{ bar: "top-(--mkt-shell-top)" }}>
          <Prose data-mkt="prose">
            <p className="text-body-2 font-medium text-fg-muted">From the {PRODUCT} journal</p>
            <h2 id="mkt-journal-title" className="mt-r4">Nobody reads your changelog. It is not their fault.</h2>
            <p className="text-body-2 text-fg-muted">Maya Okafor, Head of Writing · 8 minute read</p>
            <p className="text-prose-1">
              Most changelogs are written for the people who built the release. They list ticket numbers,
              internal code names and the word &ldquo;various&rdquo;. Customers skim the first line, find nothing
              about their day, and stop.
            </p>
            <p>
              We read 2,300 public changelogs while building {PRODUCT}. The ones people actually read share three
              habits, and none of them needs a tool.
            </p>

            <figure>
              <Image
                src={ART.pages}
                alt="A one-page release note: a title, a short summary, and three entries, each tagged with its audience."
                {...ART_SIZE}
                ratio="wide"
                className="w-full"
              />
              <figcaption>Three audiences, one page, every entry in the order a reader needs it.</figcaption>
            </figure>

            <h3>Lead with the change, not the work</h3>
            <p>
              &ldquo;Refactored the export pipeline&rdquo; describes your sprint. &ldquo;Exports finish in seconds
              instead of a minute&rdquo; describes your customer&rsquo;s afternoon. Write the second sentence, and
              keep the first for the commit message.
            </p>

            <h3>Group by reader</h3>
            <p>A single release usually touches three audiences:</p>
            <ul>
              <li>
                <strong>Admins</strong>, who need to know what changed in billing, permissions and security.
              </li>
              <li>
                <strong>Developers</strong>, who need API changes with the old and new shapes side by side.
              </li>
              <li>
                <strong>Everyone else</strong>, who wants to know what is easier today than yesterday.
              </li>
            </ul>

            <h3>Say what to do next</h3>
            <p>Every entry answers the same three questions, in this order:</p>
            <ol>
              <li>What changed, in one sentence?</li>
              <li>Who does it affect?</li>
              <li>Is there anything to do, and where is the guide?</li>
            </ol>

            <blockquote>
              <p>
                We stopped writing release notes for ourselves. Support tickets in the week after a release
                dropped by a third.
              </p>
              <footer className="mt-r3 text-body-2 text-fg-muted">Ines Albrecht, Head of Product at Northpine</footer>
            </blockquote>

            <p>
              In practice that means one label on every pull request, <code>audience:admin</code>,{" "}
              <code>audience:dev</code> or <code>audience:all</code>, and a <code>summary:</code> line in its
              description. {PRODUCT} reads both. If your team already writes{" "}
              <a href="https://www.conventionalcommits.org/">conventional commits</a>, the <code>feat:</code> and{" "}
              <code>fix:</code> prefixes work as a fallback.
            </p>

            <SampleDraft />

            <p>
              The full essay has before-and-after examples from forty teams, and the{" "}
              <a href={href("marketing", "faq")}>questions we get most</a> are answered below.
            </p>
          </Prose>
        </ReadingProgress>
      </Container>
    </Section>
  );
}

/** UI in the prose flow: a labelled Select and a Button, on one line when there is room. */
function SampleDraft() {
  const id = useId();
  const [drafted, setDrafted] = useState<string | null>(null);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const repo = new FormData(event.currentTarget).get("repo");
    setDrafted(SAMPLE_REPOS.find((r) => r.value === repo)?.label ?? null);
  };

  return (
    <form
      onSubmit={submit}
      data-mkt="prose-ui"
      className="my-section-3 grid gap-r4 rounded-lg border border-border bg-surface-0 p-r2"
    >
      <label htmlFor={id} className="text-body-1 font-medium text-fg-primary">
        Try it on a sample repository
      </label>
      <div className="flex flex-wrap gap-r4">
        <Select id={id} name="repo" defaultValue="kiln" data-mkt="prose-select" className="min-w-0 flex-1 basis-column-md">
          {SAMPLE_REPOS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" data-mkt="prose-button">
          Draft release notes
        </Button>
      </div>
      <div aria-live="polite" className="text-body-2 text-fg-secondary empty:hidden">
        {drafted && `Drafted 14 changes from ${drafted}, grouped for 3 audiences.`}
      </div>
    </form>
  );
}

/** A post's calendar date at local midnight (never parsed as a UTC instant). */
const localDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
};

/** "More from the journal": the essay above is one of these; the rest are a grid of whole-card links. */
export function JournalPosts() {
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
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
        <SectionHeading titleId="mkt-posts-title" eyebrow="Journal" title="More from the journal." />
        <Grid as="ul" columns={{ base: 1, "@xl": 2, "@5xl": 4 }} gap="r2" className="mt-section-3">
          {POSTS.map((post) => (
            <li key={post.slug} className="flex min-w-0">
              <MediaCard
                className="flex-1"
                href={href("marketing", "journal")}
                title={post.title}
                description={post.description}
                image={post.art && { src: ART[post.art], alt: "", ...ART_SIZE }}
                badge={post.kind && <Badge variant="solid">{post.kind}</Badge>}
                meta={
                  <>
                    {post.author} · <time dateTime={post.date}>{day.format(localDate(post.date))}</time> · {post.minutes} min read
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
          ))}
        </Grid>
      </Container>
    </Section>
  );
}
