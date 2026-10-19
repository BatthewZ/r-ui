import { ImagePlus } from "lucide-react";
import { useState } from "react";

import { Button, EmptyState, Image, Lightbox, MasonryGrid, MediaCard, SegmentedControl } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";
import { LIGHTBOX_ITEMS, PHOTOS } from "./gallery.examples";

export const meta = {
  title: "MasonryGrid",
  group: "media",
  order: 30,
  description:
    "Items of differing heights packed into columns chosen by the GRID's own width. Source order is kept: each item goes to the shortest column so far, so reading top to bottom meets them in tab order. Works with Image, Lightbox triggers and MediaCards; boxes sized before their pictures load never move what is below them.",
};

type Width = "narrow" | "medium" | "full";
// Literal class names, so the build sees them.
const WIDTHS: Record<Width, string> = { narrow: "max-w-(--COLUMN-LG)", medium: "w-1/2", full: "w-full" };

function Gallery() {
  return (
    <Lightbox items={LIGHTBOX_ITEMS} label="Field trip">
      <MasonryGrid list minColumn="sm" data-sc="masonry-gallery">
        {LIGHTBOX_ITEMS.map((item, i) => (
          <Lightbox.Trigger key={item.id} index={i}>
            <Image
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              placeholder={item.placeholder}
              placeholderColor={item.placeholderColor}
              className="w-full"
            />
          </Lightbox.Trigger>
        ))}
      </MasonryGrid>
    </Lightbox>
  );
}

function Resizable() {
  const [width, setWidth] = useState<Width>("full");
  return (
    <div className="grid gap-r4">
      <SegmentedControl aria-label="Grid width" value={width} onValueChange={(v) => setWidth(v as Width)} className="justify-self-start">
        <SegmentedControl.Item value="narrow">Narrow</SegmentedControl.Item>
        <SegmentedControl.Item value="medium">Half</SegmentedControl.Item>
        <SegmentedControl.Item value="full">Full</SegmentedControl.Item>
      </SegmentedControl>
      <div className={WIDTHS[width]} data-sc="masonry-resizable-frame">
        <MasonryGrid minColumn="sm" gap="r4" data-sc="masonry-resizable">
          {PHOTOS.slice(0, 8).map((p) => (
            <Image key={p.id} src={p.src} alt={p.title} width={p.width} height={p.height} placeholderColor={p.color} className="w-full" />
          ))}
        </MasonryGrid>
      </div>
    </div>
  );
}

const POSTS = [
  { title: "Group by reader: one release, three audiences", description: "Admins, developers and everyone else want different things from the same release.", photo: 0 },
  { title: "A house style for release notes", photo: 4 },
  {
    title: "What we learned shipping a design system twice",
    description:
      "The second time, the contract came first: tokens, checks and themes before a single component. It took longer to start and much less time to finish, and the components stopped arguing about spacing.",
    photo: 2,
  },
  { title: "Field notes from the dunes", description: "Twelve photographs, one morning.", photo: 1 },
  { title: "Reallylongunbrokenwordthatwouldotherwisewidenthecard", photo: 6 },
  { title: "Why compact is a choice, not a screen size", description: "Density is an axis of its own.", photo: 9 },
];

function Cards() {
  return (
    <MasonryGrid minColumn="md" data-sc="masonry-cards">
      {POSTS.map((post) => {
        const p = PHOTOS[post.photo]!;
        return (
          <MediaCard
            key={post.title}
            href="#/overview/media-masonrygrid"
            title={post.title}
            description={post.description}
            meta="4 min read"
            image={{ src: p.src, alt: "", width: p.width, height: p.height }}
            ratio={p.height > p.width ? "portrait" : "wide"}
          />
        );
      })}
    </MasonryGrid>
  );
}

export default function MasonryGridSection() {
  return (
    <Stack>
      <Row label="A gallery that opens a Lightbox: twelve photos in source order, a list of buttons">
        <Gallery />
      </Row>
      <Row label="Columns follow the grid's own width, not the viewport's">
        <Resizable />
      </Row>
      <Row label="MediaCards of differing lengths, a long unbroken title included">
        <Cards />
      </Row>
      <Row label="Loading: the boxes hold their final size before a byte arrives · empty">
        <div className="grid gap-r3">
          <MasonryGrid minColumn="sm" aria-busy data-sc="masonry-loading">
            {PHOTOS.slice(0, 6).map((p) => (
              <Image key={p.id} src={null} alt={p.title} width={p.width} height={p.height} placeholderColor={p.color} className="w-full" />
            ))}
          </MasonryGrid>
          <EmptyState
            icon={<ImagePlus />}
            title="No photos yet"
            description="Photos you add to this album appear here, newest first."
            actions={<Button variant="secondary">Add photos</Button>}
          />
        </div>
      </Row>
      <Row label="RTL and compact: the first column is on the right, the gap shrinks">
        <div dir="rtl" data-density="compact">
          <MasonryGrid minColumn="sm" data-sc="masonry-rtl">
            {PHOTOS.slice(4, 10).map((p) => (
              <Image key={p.id} src={p.src} alt={p.title} width={p.width} height={p.height} placeholderColor={p.color} className="w-full" />
            ))}
          </MasonryGrid>
        </div>
      </Row>
    </Stack>
  );
}
