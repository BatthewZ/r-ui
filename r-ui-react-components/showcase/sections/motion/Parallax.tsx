import { Button } from "../../../src/components/primitives";
import { Parallax, type ParallaxStrength } from "../../../src/components/motion";
import { PHOTOS } from "../media/gallery.examples";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Parallax",
  group: "motion",
  order: 40,
  description:
    "A decorative backdrop that drifts more slowly than the page, on a CSS view timeline: no script, no scroll handler. The box is aria-hidden, inert and takes no pointer, so text and controls sit beside it, never in it; the drift is clipped, so layout and hit areas never move. Still under reduced motion, in print and where scroll-driven animations are missing. Its frame here is not a scroller: a view timeline follows the nearest scroll container.",
  frame: "open",
};

const photo = (id: string) => PHOTOS.find((p) => p.id === id) ?? PHOTOS[0]!;

function Hero({ id, strength, title, lead, cta }: { id: string; strength?: ParallaxStrength; title: string; lead: string; cta: string }) {
  const { src } = photo(id);
  return (
    <section
      data-sc="parallax-hero"
      className="relative isolate grid min-h-[calc(var(--CONTROL-H)*8)] place-items-center rounded-lg border border-border p-r1"
    >
      <Parallax data-sc="parallax" strength={strength} className="absolute inset-0 rounded-lg">
        <img src={src} alt="" className="size-full object-cover" />
      </Parallax>
      <div className="relative grid max-w-measure min-w-0 gap-r3 rounded-lg border border-border bg-surface-0 p-r2 text-center">
        <h3 className="text-display-3 break-words">{title}</h3>
        <p className="text-prose-2 text-fg-secondary">{lead}</p>
        <div className="flex flex-wrap justify-center gap-r4">
          <Button>{cta}</Button>
        </div>
      </div>
    </section>
  );
}

export default function ParallaxSection() {
  return (
    <Stack>
      <Row label="A hero's backdrop (medium); the text panel and its button stay in the page, above the layer">
        <Hero
          id="fjord"
          title="Ship on calm water"
          lead="Scroll the page: the picture behind this panel trails it by a few motion distances, and the panel never moves."
          cta="Start free"
        />
      </Row>
      <Row label="subtle and strong, side by side">
        <div className="grid gap-r3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--COLUMN-MD)),1fr))]">
          <Hero id="dunes" strength="subtle" title="subtle" lead="Half of --PARALLAX-SHIFT each way." cta="Read more" />
          <Hero id="pines" strength="strong" title="strong" lead="One and a half --PARALLAX-SHIFT each way." cta="Read more" />
        </div>
      </Row>
      <Row label="RTL and compact: the drift is on the block axis only, so nothing mirrors">
        <div dir="rtl" lang="ar" data-density="compact">
          <Hero id="lake" title="أبحر في مياه هادئة" lead="الصورة خلف هذه اللوحة تتحرك أبطأ من الصفحة." cta="ابدأ مجانًا" />
        </div>
      </Row>
    </Stack>
  );
}
