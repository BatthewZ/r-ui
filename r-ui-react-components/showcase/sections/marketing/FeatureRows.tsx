import { ArrowRight } from "lucide-react";

import { Button, FeatureRows, Link } from "../../../src";
import grid from "../../pages/marketing/art/grid.svg";
import pages from "../../pages/marketing/art/pages.svg";
import readers from "../../pages/marketing/art/readers.svg";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "FeatureRows",
  group: "marketing",
  order: 120,
  description:
    "Text beside media, the media alternating sides from row to row once the ROWS are wide (@3xl), stacked below that (media first, or last). Every row is text then media in the DOM: the alternation is grid placement only, so reading and tab order never zig-zag. Mirrors in RTL.",
};

const Art = ({ src, alt }: { src: string; alt: string }) => (
  <img src={src} alt={alt} width={1600} height={900} className="aspect-video w-full rounded-lg border object-cover" />
);

const More = () => (
  <Link href="#/overview/marketing-featurerows" className="inline-flex items-center gap-r6">
    Read the guide <ArrowRight aria-hidden className="size-icon rtl:-scale-x-100" />
  </Link>
);

export default function FeatureRowsSection() {
  return (
    <Stack>
      <Row label="Three rows, alternating (end, start, end) · eyebrow, title, body, actions · titles h4">
        <FeatureRows headingLevel={4} data-sc="rows-alternating">
          <FeatureRows.Row
            eyebrow="Drafts"
            title="The first ninety percent, written for you."
            media={<Art src={pages} alt="A release note drafted from three pull requests" />}
            actions={
              <>
                <Button>Start free</Button>
                <More />
              </>
            }
          >
            <p>Every merged pull request becomes a line in plain words, linked to its source, before anyone asks.</p>
          </FeatureRows.Row>
          <FeatureRows.Row
            eyebrow="Audiences"
            title="Each reader sees what touches them."
            media={<Art src={readers} alt="Three audiences, each with its own list of changes" />}
            actions={<More />}
          >
            <p>Admins, developers and end users get their own cut of the same release, sorted by who each change affects.</p>
          </FeatureRows.Row>
          <FeatureRows.Row
            eyebrow="Publishing"
            title="One click, every channel."
            media={<Art src={grid} alt="The changelog page, an in-app panel and an email digest" />}
          >
            <p>Changelog page, in-app panel, email digest and RSS, from one place, in your workspace's time zone.</p>
          </FeatureRows.Row>
        </FeatureRows>
      </Row>
      <Row label="A narrow column (stacked) · media last · a long unbroken word wraps">
        <div className="max-w-column-lg" data-sc="rows-narrow">
          <FeatureRows headingLevel={4} stackedMedia="last">
            <FeatureRows.Row
              title="Versionshinweise-ohne-Nacharbeit"
              media={<Art src={pages} alt="A drafted release note" />}
            >
              <p>The media shows under the text here; at full width it would sit beside it.</p>
            </FeatureRows.Row>
          </FeatureRows>
        </div>
      </Row>
      <Row label="Media fixed at the start, compact density (UI parts follow it; the display title does not)">
        <div data-density="compact">
          <FeatureRows headingLevel={4} mediaSide="start">
            <FeatureRows.Row title="Fixed side" media={<Art src={grid} alt="A grid of channels" />} actions={<Button variant="secondary">Book a demo</Button>}>
              <p>Every row puts its media on the start side.</p>
            </FeatureRows.Row>
          </FeatureRows>
        </div>
      </Row>
      <Row label="RTL · alternating mirrors: the first row's media sits on the left">
        <div dir="rtl" data-sc="rows-rtl">
          <FeatureRows headingLevel={4}>
            <FeatureRows.Row eyebrow="المسودات" title="التسعون بالمئة الأولى مكتوبة لك." media={<Art src={pages} alt="ملاحظة إصدار" />}>
              <p>يصبح كل طلب دمج سطرًا بكلمات بسيطة مرتبطًا بمصدره.</p>
            </FeatureRows.Row>
            <FeatureRows.Row eyebrow="الجمهور" title="يرى كل قارئ ما يخصه." media={<Art src={readers} alt="ثلاثة جماهير" />}>
              <p>يحصل كل جمهور على نسخته من الإصدار نفسه.</p>
            </FeatureRows.Row>
          </FeatureRows>
        </div>
      </Row>
    </Stack>
  );
}
