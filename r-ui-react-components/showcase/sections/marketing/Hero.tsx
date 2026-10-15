import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { Badge, Button, cn, Hero } from "../../../src";
import kiln from "../../pages/marketing/art/kiln.svg";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Hero",
  group: "marketing",
  order: 10,
  description:
    "Eyebrow, display title (fluid scale, display face), prose lead, actions, media and a proof row. Stacked and centred, or split beside its media when the HERO is wide; an optional band; any heading level. The actions stay UI-sized at every density.",
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

/** A frame around each demo so the hero's own edges (and its band) show. */
const Frame = ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
  <div className="overflow-hidden rounded-lg border border-border" {...props}>
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
