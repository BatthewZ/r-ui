import { Card } from "../../../src/components/primitives";
import { ScrollReveal } from "../../../src/components/motion";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "ScrollReveal",
  group: "motion",
  order: 10,
  description:
    "An entrance played when content first scrolls into view. Only content below the fold at mount is ever hidden, so nothing on screen blinks and nothing waits without script; reduced motion shows everything as it is.",
};

const CARDS = [
  { title: "fade-up", animation: "fade-up", note: "The default: a small rise (--MOTION-DISTANCE-MD) and a fade." },
  { title: "fade-in", animation: "fade-in", note: "Opacity only, for content that should not move." },
  { title: "scale-in", animation: "scale-in", note: "From --MOTION-SCALE-FROM, for a figure or a card." },
] as const;

export default function ScrollRevealSection() {
  return (
    <Stack>
      <Row label="Each plays once, the first time it scrolls into view (reload the page above them to see it)">
        <div className="grid gap-r3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--COLUMN-SM)),1fr))]">
          {CARDS.map(({ title, animation, note }) => (
            <ScrollReveal key={title} animation={animation} data-sc="reveal-card">
              <Card className="h-full">
                <Card.Header>
                  <Card.Title>
                    <code className="font-mono">{title}</code>
                  </Card.Title>
                  <Card.Description>{note}</Card.Description>
                </Card.Header>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </Row>
      <Row label="once={false}: hides again below the fold and replays on the way back down">
        <ScrollReveal once={false} className="max-w-measure">
          <p className="text-body-1 text-fg-secondary">
            Scrolled past upwards, it stays shown; it only re-arms once it is back below the fold, so reading back up
            never replays it.
          </p>
        </ScrollReveal>
      </Row>
    </Stack>
  );
}
