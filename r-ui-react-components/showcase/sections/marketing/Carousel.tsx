import { Card, Carousel, MediaCard } from "../../../src";
import grid from "../../pages/marketing/art/grid.svg";
import kiln from "../../pages/marketing/art/kiln.svg";
import pages from "../../pages/marketing/art/pages.svg";
import readers from "../../pages/marketing/art/readers.svg";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Carousel",
  group: "marketing",
  order: 30,
  description:
    "A native scroll-snap track: swipe, trackpad and the focused track's arrow keys all move it, every slide is reachable without the buttons, and the next slide peeks in. Slides per view follow the CAROUSEL's width. A status line, or dots as a tablist when the slides are tab-like. No autoplay unless asked; then a pause control, pausing on hover and focus, and never starting under reduced motion.",
};

const ART = [readers, kiln, grid, pages];
const POSTS = [
  "Group by reader",
  "What we changed about release day",
  "Writing about permissions",
  "A house style in nine rules",
  "Release notes for APIs",
  "The changelog nobody asked for",
  "Dates, time zones and exports",
  "When to say nothing",
];

const STEPS = [
  { title: "Connect", body: "Point Kiln at a repository. It reads pull request titles, labels and descriptions." },
  { title: "Review", body: "Kiln drafts the note, grouped by reader. Edit a sentence or two." },
  { title: "Publish", body: "One click sends it to your docs, the in-app panel, RSS and email." },
];

function Step({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <Card className="h-full px-r2">
      <p className="text-body-3 font-medium text-fg-muted">Step {index}</p>
      <p className="text-display-4 text-fg-primary">{title}</p>
      <p className="max-w-measure text-prose-3 text-fg-secondary">{body}</p>
    </Card>
  );
}

export default function CarouselSection() {
  return (
    <Stack>
      <Row label="Up to three per view by the carousel's width · status line · media cards as slides">
        <div data-sc-scrolls="" data-sc="carousel-cards">
          <Carousel label="From the journal" perView={3}>
            {POSTS.map((title, i) => (
              <Carousel.Slide key={title} className="flex">
                <MediaCard
                  className="flex-1"
                  href="#/overview/marketing-carousel"
                  title={title}
                  meta={`${4 + (i % 4)} min read`}
                  image={{ src: ART[i % ART.length]!, alt: "", width: 1600, height: 900 }}
                />
              </Carousel.Slide>
            ))}
          </Carousel>
        </div>
      </Row>
      <Row label="One per view, tab-like steps · dots are a tablist">
        <div data-sc-scrolls="" className="max-w-measure">
          <Carousel label="How it works" dots>
            {STEPS.map((step, i) => (
              <Carousel.Slide key={step.title}>
                <Step index={i + 1} {...step} />
              </Carousel.Slide>
            ))}
          </Carousel>
        </div>
      </Row>
      <Row label="Autoplay (opt-in, 5s) · pause / play · pauses on hover and focus · off under reduced motion">
        <div data-sc-scrolls="" data-sc="carousel-autoplay" className="max-w-measure">
          <Carousel label="Customer quotes" autoplay={5000}>
            {["Support tickets dropped by a third.", "Sales forwards our notes unedited.", "Legal said yes."].map((q) => (
              <Carousel.Slide key={q}>
                <Card className="h-full px-r2">
                  <blockquote className="text-prose-2 text-fg-primary">&ldquo;{q}&rdquo;</blockquote>
                </Card>
              </Carousel.Slide>
            ))}
          </Carousel>
        </div>
      </Row>
      <Row label="RTL · two per view · compact density">
        <div data-sc-scrolls="" data-sc="carousel-rtl" dir="rtl" data-density="compact">
          <Carousel
            label="مقالات"
            perView={2}
            labels={{ prev: "الشريحة السابقة", next: "الشريحة التالية", status: (f, l, t) => `${f}–${l} من ${t}` }}
          >
            {POSTS.slice(0, 5).map((title, i) => (
              <Carousel.Slide key={title} className="flex">
                <MediaCard
                  className="flex-1"
                  href="#/overview/marketing-carousel"
                  title={`مقال ${i + 1}`}
                  meta="٥ دقائق"
                  image={{ src: ART[i % ART.length]!, alt: "", width: 1600, height: 900 }}
                />
              </Carousel.Slide>
            ))}
          </Carousel>
        </div>
      </Row>
    </Stack>
  );
}
