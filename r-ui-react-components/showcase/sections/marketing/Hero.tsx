import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Badge, Button, cn, Hero, Parallax } from "../../../src";
import kiln from "../../pages/marketing/art/kiln.svg";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Hero",
  group: "marketing",
  order: 10,
  description:
    "Eyebrow, display title (fluid scale, display face), prose lead, actions, media and a proof row. Stacked and centred, or split beside its media when the HERO is wide; an optional band; any heading level; a decorative backdrop behind it all (here a Parallax). The actions stay UI-sized at every density. Its frame is not a scroller, so a view timeline in a backdrop follows the page.",
  frame: "open",
};

const Proof = () => (
  <p className="text-body-2 text-fg-muted">
    Trusted by 1,400 product teams · <span className="font-medium text-fg-secondary">4.8 / 5</span> from 310 reviews
  </p>
);

const Actions = () => (
  <>
    <Button iconEnd={<ArrowRight className="rtl:-scale-x-100" />}>Start free</Button>
    <Button variant="secondary">Book a demo</Button>
  </>
);

const Art = ({ className }: { className?: string }) => (
  <img
    src={kiln}
    alt="A kiln glowing in the dark"
    width={1600}
    height={900}
    className={cn("aspect-video w-full rounded-lg border object-cover", className)}
  />
);

/** Contour rings in the accent ink, faint enough to sit under text; `slice` crops them to any hero's ratio. */
const Contours = () => (
  <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="size-full text-fg-accent" fill="none" stroke="currentColor">
    {[1, 2, 3, 4, 5, 6, 7].map((ring) => (
      <g key={ring} strokeOpacity={0.3 - ring * 0.03} strokeWidth={2}>
        <circle cx={160} cy={140} r={ring * 70} />
        <circle cx={1460} cy={780} r={ring * 80} />
      </g>
    ))}
    <circle cx={1300} cy={160} r={36} fill="currentColor" fillOpacity={0.12} stroke="none" />
    <circle cx={320} cy={760} r={22} fill="currentColor" fillOpacity={0.12} stroke="none" />
  </svg>
);

/** A frame around each demo so the hero's own edges (and its band) show. It clips without scrolling, so a backdrop's view timeline reaches the page. */
const Frame = ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
  <div className="overflow-clip rounded-lg border border-border" {...props}>
    {children}
  </div>
);

export default function HeroSection() {
  return (
    <Stack>
      <Row label="Stacked (default) · media and proof · headingLevel 2 (the Overview owns the h1)">
        <Frame>
          <Hero
            headingLevel={2}
            eyebrow="Release notes"
            title="Release notes your customers actually read."
            lead="Drafted from the pull requests you already merged, sorted by who each change affects, and published everywhere at once."
            actions={<Actions />}
            media={<Art className="mx-auto max-w-measure" />}
            proof={<Proof />}
          />
        </Frame>
      </Row>
      <Row label="Backdrop · a Parallax of contour rings behind the content: hidden, inert and pressed through, drifting as the page scrolls (still under reduced motion)">
        <Frame data-sc="hero-backdrop">
          <Hero
            headingLevel={2}
            eyebrow="Field notes"
            title="Maps for teams that move."
            lead="The rings behind this text trail the page as you scroll; the text and its buttons never move, and every press lands on them."
            actions={<Actions />}
            backdrop={
              <Parallax className="size-full">
                <Contours />
              </Parallax>
            }
            proof={<Proof />}
          />
        </Frame>
      </Row>
      <Row label="Split on a band · media beside the text when the hero is wide, under it when narrow">
        <Frame data-sc="hero-split">
          <Hero
            headingLevel={2}
            layout="split"
            variant="band"
            eyebrow={<Badge tone="accent">New in 4.2</Badge>}
            title="Schedule any export."
            lead="Daily or weekly, by email, in your workspace's time zone."
            actions={<Actions />}
            media={<Art />}
          />
        </Frame>
      </Row>
      <Row label="Title only · long unbroken words wrap · compact density keeps the display scale">
        <Frame data-density="compact">
          <Hero
            headingLevel={2}
            title="Supercalifragilisticexpialidocious-release-notes-for-everyone"
            lead="UI parts follow density; the display title and the lead do not."
            actions={<Button>Start free</Button>}
          />
        </Frame>
      </Row>
      <Row label="RTL · split">
        <Frame dir="rtl">
          <Hero
            headingLevel={2}
            layout="split"
            eyebrow="ملاحظات الإصدار"
            title="ملاحظات إصدار يقرؤها عملاؤك فعلًا."
            lead="مسودة من طلبات الدمج التي دمجتها بالفعل، مرتبة حسب من يتأثر بكل تغيير."
            actions={<Actions />}
            media={<Art />}
          />
        </Frame>
      </Row>
    </Stack>
  );
}
