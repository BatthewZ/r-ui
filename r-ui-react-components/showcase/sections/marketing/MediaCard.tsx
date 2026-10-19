import { Bookmark, Share2 } from "lucide-react";
import { useState } from "react";

import { Badge, IconButton, MediaCard } from "../../../src";
import grid from "../../pages/marketing/art/grid.svg";
import pages from "../../pages/marketing/art/pages.svg";
import readers from "../../pages/marketing/art/readers.svg";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "MediaCard",
  group: "marketing",
  order: 20,
  description:
    "The whole card is one link (a stretched pseudo-element), named by its title, ringed as a whole on focus; secondary actions stay their own tab stops and press targets. Lazy images (the media group's Image) in a ratio box, a placeholder with no image, a broken one's glyph and words, a skeleton, a hover lift that reduced motion stills.",
};

const GRID = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--COLUMN-MD)),1fr))] gap-r2";
const art = (src: string) => ({ src, alt: "", width: 1600, height: 900 });

function SaveButton({ title }: { title: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <IconButton label={`Save “${title}” for later`} icon={<Bookmark />} aria-pressed={saved} onClick={() => setSaved(!saved)} />
  );
}

export default function MediaCardSection() {
  return (
    <Stack>
      <Row label="Image, badge, meta and one secondary action · no image · a broken image">
        <div className={GRID} data-sc="media-cards">
          <MediaCard
            href="#/overview/marketing-mediacard"
            title="Group by reader: one release, three audiences"
            description="Admins, developers and everyone else want different things from the same release."
            meta="Maya Okafor · 6 min read"
            image={art(readers)}
            badge={<Badge variant="solid">Guide</Badge>}
            actions={<SaveButton title="Group by reader" />}
          />
          <MediaCard
            href="#/overview/marketing-mediacard"
            title="A house style for release notes, in nine rules"
            description="No cover image: the media box keeps its ratio and shows a quiet placeholder."
            meta="Ines Albrecht · 5 min read"
            badge={<Badge>Template</Badge>}
          />
          <MediaCard
            href="#/overview/marketing-mediacard"
            title="The cover failed to load"
            description="A broken image shows Image's fallback: the glyph and its alt text."
            meta="Joris van Dijk · 4 min read"
            image={{ src: "data:image/png;base64,bm90LWFuLWltYWdl", alt: "Release day", width: 1600, height: 900 }}
            actions={
              <>
                <SaveButton title="The cover failed to load" />
                <IconButton label="Share" icon={<Share2 />} />
              </>
            }
          />
        </div>
      </Row>
      <Row label="Ratios: square, classic (4:3), portrait (3:4) · a long unbroken title wraps">
        <div className={GRID}>
          <MediaCard href="#/overview/marketing-mediacard" ratio="square" title="Square" image={art(grid)} meta="1:1" />
          <MediaCard href="#/overview/marketing-mediacard" ratio="classic" title="Classic" image={art(pages)} meta="4:3" />
          <MediaCard
            href="#/overview/marketing-mediacard"
            ratio="portrait"
            title="Reallylongunbrokenwordthatwouldotherwisewidenthecard"
            image={art(readers)}
            meta="3:4"
          />
        </div>
      </Row>
      <Row label="Loading · compact density">
        <div className={GRID}>
          <MediaCard.Skeleton label="Loading articles" />
          <MediaCard.Skeleton />
          <div data-density="compact" className="flex">
            <MediaCard
              className="flex-1"
              href="#/overview/marketing-mediacard"
              title="Compact: meta, actions and padding shrink"
              description="The title and description keep their fluid scale."
              meta="2 min read"
              image={art(pages)}
              actions={<SaveButton title="Compact" />}
            />
          </div>
        </div>
      </Row>
      <Row label="RTL">
        <div className={GRID} dir="rtl">
          <MediaCard
            href="#/overview/marketing-mediacard"
            title="ملاحظات الإصدار حسب القارئ"
            description="كل جمهور يرى التغييرات التي تهمه."
            meta="٦ دقائق قراءة"
            image={art(readers)}
            badge={<Badge variant="solid">دليل</Badge>}
            actions={<SaveButton title="ملاحظات الإصدار" />}
          />
          <MediaCard href="#/overview/marketing-mediacard" title="دليل الأسلوب" meta="٥ دقائق قراءة" badge={<Badge>قالب</Badge>} />
        </div>
      </Row>
    </Stack>
  );
}
