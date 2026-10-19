import { Images } from "lucide-react";
import { useState } from "react";

import { Button, Image, Lightbox, type LightboxItem, type LightboxLabels } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";
import { LIGHTBOX_ITEMS } from "./gallery.examples";

export const meta = {
  title: "Lightbox",
  group: "media",
  order: 20,
  description:
    "A modal gallery viewer on the library's Dialog. Opens from any thumbnail at its index (or from outside, controlled); previous / next by button, arrow keys (mirrored in RTL) and touch swipe; a live counter; captions; the shown picture blurs up and its neighbours are preloaded. Escape returns focus to the thumbnail it opened from.",
};

const THUMBS = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,var(--COLUMN-SM)),1fr))] gap-r4";
const BROKEN = "data:image/png;base64,bm90LWFuLWltYWdl";

const ITEMS = LIGHTBOX_ITEMS;

function Thumbnails({ items, start = 0, count }: { items: readonly LightboxItem[]; start?: number; count: number }) {
  return items.slice(start, start + count).map((item, n) => (
    <Lightbox.Trigger key={item.id} index={start + n}>
      <Image
        src={item.src}
        alt={item.alt}
        width={item.width}
        height={item.height}
        ratio="square"
        placeholder={item.placeholder}
        placeholderColor={item.placeholderColor}
        className="w-full"
      />
    </Lightbox.Trigger>
  ));
}

function FromOutside() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" iconStart={<Images />} className="justify-self-start" onClick={() => setOpen(true)} data-sc="lightbox-view-all">
        View all {ITEMS.length} photos
      </Button>
      <Lightbox items={ITEMS} label="Field trip, all photos" open={open} onOpenChange={setOpen} defaultIndex={ITEMS.length - 1} />
    </>
  );
}

const ARABIC: Partial<LightboxLabels> = {
  position: (i, n) => `${i.toLocaleString("ar-EG")} من ${n.toLocaleString("ar-EG")}`,
  prev: "الصورة السابقة",
  next: "الصورة التالية",
  close: "إغلاق",
  carousel: "عرض شرائح",
  slideRole: "شريحة",
};

const WITH_FAILURE: LightboxItem[] = [
  ITEMS[1]!,
  { id: "broken", src: BROKEN, alt: "Crew photo from the launch party", width: 1200, height: 800, caption: "This one failed to load." },
  ITEMS[2]!,
];

export default function LightboxSection() {
  return (
    <Stack>
      <Row label="Thumbnails open the viewer at their own picture (twelve in all: arrows, swipe, Home / End inside)">
        <Lightbox items={ITEMS} label="Field trip">
          <div className={THUMBS} data-sc="lightbox-strip">
            <Thumbnails items={ITEMS} count={6} />
          </div>
        </Lightbox>
      </Row>
      <Row label="Opened from outside (controlled), at the last picture; focus returns to the button">
        <div className="grid">
          <FromOutside />
        </div>
      </Row>
      <Row label="RTL with translated words: ArrowLeft goes forward, the previous button sits on the right">
        <div dir="rtl">
          <Lightbox items={ITEMS} label="رحلة ميدانية" labels={ARABIC}>
            <div className={THUMBS} data-sc="lightbox-rtl">
              <Thumbnails items={ITEMS} start={6} count={3} />
            </div>
          </Lightbox>
        </div>
      </Row>
      <Row label="A picture that fails shows its alt text in the stage · one picture has no previous / next">
        <div className={THUMBS}>
          <Lightbox items={WITH_FAILURE} label="Launch party">
            <Lightbox.Trigger index={1}>
              <Image src={BROKEN} alt="Crew photo from the launch party" width={1200} height={800} ratio="square" className="w-full" />
            </Lightbox.Trigger>
          </Lightbox>
          <Lightbox items={ITEMS.slice(3, 4)} label="One photo">
            <Thumbnails items={ITEMS.slice(3, 4)} count={1} />
          </Lightbox>
        </div>
      </Row>
    </Stack>
  );
}
