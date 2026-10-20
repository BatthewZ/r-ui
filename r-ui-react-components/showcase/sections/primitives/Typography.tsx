import { Prose } from "../../../src/components/layout";
import { Row, Stack } from "./parts/demo";
import { TypeSample } from "./parts/type-spec";

export const meta = {
  title: "Typography",
  group: "primitives",
  order: 5,
  description:
    "Every text size the contract ships, with what it resolves to under the current View. The UI scale (headings and body) follows density; the display and prose scales are fluid with their container, and long-form text sits at the reading measure (--MEASURE).",
};

const HEADING = "Release notes for the spring quarter, with every fix the platform team shipped";

const BODY =
  "Checkout latency fell by a third after the payments worker moved to the new queue. The change shipped behind a flag on Tuesday, ran on five percent of traffic for a day, and reached everyone by Thursday afternoon. Error rates stayed flat throughout, and the on-call team closed the incident review with two follow-ups: a dashboard for queue depth, and an alert on retries that grow faster than requests.";

export default function TypographySection() {
  return (
    <Stack>
      <Row label="In-app headings · text-h1 to text-h6 · UI scale, density-driven · in a column, so each wraps">
        <div className="grid max-w-column-lg gap-r2">
          {(["text-h1", "text-h2", "text-h3", "text-h4", "text-h5", "text-h6"] as const).map((name) => (
            <TypeSample key={name} name={name} className={`${name} text-fg-primary`}>
              {HEADING}
            </TypeSample>
          ))}
        </div>
      </Row>

      <Row label="UI body text · text-body-1 (large), text-body-2 (medium), text-body-3 (small) · at the reading measure">
        <div className="grid max-w-measure gap-r2">
          <TypeSample name="text-body-1" className="text-body-1 text-fg-primary">
            {BODY}
          </TypeSample>
          <TypeSample name="text-body-2" className="text-body-2 text-fg-secondary">
            {BODY}
          </TypeSample>
          <TypeSample name="text-body-3" className="text-body-3 text-fg-secondary">
            {BODY}
          </TypeSample>
        </div>
      </Row>

      <Row label="Display · text-display-1 to text-display-4 · marketing headlines, fluid with the container's width">
        <div className="grid gap-r2">
          {(["text-display-1", "text-display-2", "text-display-3", "text-display-4"] as const).map((name) => (
            <TypeSample key={name} name={name} className={`${name} text-fg-primary`}>
              Ship release notes your customers read
            </TypeSample>
          ))}
        </div>
      </Row>

      <Row label="Prose sizes · text-prose-1 (lead), text-prose-2 (body), text-prose-3 (small print) · fluid, reading leading, at --MEASURE">
        {/* At the body prose size, so the measure counts body characters, as in a Prose region. */}
        <div className="grid max-w-measure gap-r2 text-prose-2">
          <TypeSample name="text-prose-1" width className="text-prose-1 text-fg-primary">
            {BODY}
          </TypeSample>
          <TypeSample name="text-prose-2" width className="text-prose-2 text-fg-primary">
            {BODY}
          </TypeSample>
          <TypeSample name="text-prose-3" width className="text-prose-3 text-fg-secondary">
            {BODY}
          </TypeSample>
        </div>
      </Row>

      <Row label="An article, as a blog or docs page shows it: a Prose region (headings on the display scale, body on prose-2), capped at --MEASURE">
        <Prose>
          <h2 className="text-display-1">How we cut checkout latency by a third</h2>
          <p className="text-prose-1 text-fg-secondary">
            A queue change, a flag and three days of careful rollout. This is what we measured, what surprised us, and
            what we would do differently next time.
          </p>
          <p>
            For most of last year the payments worker read its jobs from the same queue as every other service. On a
            quiet day that was fine. On a busy one, a burst of image resizing could sit in front of a customer&apos;s
            payment for several seconds, and the checkout page would wait with it. Nobody had designed it that way; it
            had simply grown that way, one new job type at a time.
          </p>
          <p>
            The fix was not clever. We gave payments a queue of its own, sized for its peak rather than the
            platform&apos;s average, and moved the worker across behind a flag. The interesting part was proving that
            it helped, and proving it quickly enough that nobody had to take it on faith.
          </p>
          <h3>Rolling out without guessing</h3>
          <p>
            We started with five percent of traffic and two numbers on a screen: the p95 latency of the checkout call,
            and the error rate of the payments worker. A rollout only moves forward when both hold for a full business
            day.
          </p>
          <ul>
            <li>Five percent on Tuesday morning, watched through the lunchtime peak.</li>
            <li>Half of all traffic on Wednesday, after the overnight batch ran clean.</li>
            <li>Everyone on Thursday afternoon, with the old queue kept warm for a week.</li>
          </ul>
          <blockquote>The best rollback plan is the one you never use, but rehearse anyway.</blockquote>
          <h4>What we would change</h4>
          <p>
            Queue depth should have been on a dashboard from the start. It was the first thing we looked for when the
            numbers moved, and it was the one thing we had to query by hand.
          </p>
          <figure>
            <figcaption>
              Latency figures are the 95th percentile over a rolling hour, measured at the edge, across all regions.
            </figcaption>
          </figure>
        </Prose>
      </Row>
    </Stack>
  );
}
