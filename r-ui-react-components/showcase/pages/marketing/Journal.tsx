import { type SubmitEvent, useId, useState } from "react";

import { Button, Container, Prose, Section, Select } from "../../../src";
import { href } from "../../shell/router";
import { PRODUCT, SAMPLE_REPOS } from "./content";

/**
 * A long-form excerpt on the prose scale, with a small form in its flow. The
 * form is NOT a `.not-prose` island: the region sets no font size of its own, so
 * the Select and Button keep the UI scale (control height, UI leading) with no
 * help. `scripts/browser/marketing-page.js` measures exactly that.
 */
export function Journal() {
  return (
    <Section id="journal" variant="band" aria-labelledby="mkt-journal-title">
      <Container>
        <Prose as="article" className="mx-auto" data-mkt="prose">
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
