import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Image, type ImageProps, type ImageRadius, type ImageRatio } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";
import { PHOTOS } from "./gallery.examples";

export const meta = {
  title: "Image",
  group: "media",
  order: 10,
  description:
    "A picture whose box is sized before it loads (no layout shift): the file's ratio or a named one, cover or contain, a radius from the scale. While it travels, a dominant colour and a tiny blurred preview fill the box, then the picture cross-fades in (at once under reduced motion). Lazy and async-decoded by default, priority on demand; a failure keeps the alt text.",
};

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,var(--COLUMN-SM)),1fr))] items-start gap-r3";
/** An undecodable image: it fails without a network request or a console error. */
const BROKEN = "data:image/png;base64,bm90LWFuLWltYWdl";

const photo = (i: number) => PHOTOS[i % PHOTOS.length]!;
const props = (i: number): Pick<ImageProps, "src" | "alt" | "width" | "height"> => {
  const p = photo(i);
  return { src: p.src, alt: p.title, width: p.width, height: p.height };
};

/** Mounts with no address and receives it after `delay`, as a slow network would deliver it. */
function SlowImage({ delay, ...rest }: Omit<ImageProps, "src"> & { src: string; delay: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setSrc(rest.src), delay);
    return () => window.clearTimeout(timer);
  }, [rest.src, delay]);
  return <Image {...rest} src={src} />;
}

function SlowLoads() {
  const [round, setRound] = useState(0);
  const cases = [
    { note: "Tiny preview + dominant colour", i: 0, blur: true, colour: true },
    { note: "Dominant colour only", i: 4, blur: false, colour: true },
    { note: "Neither: the ink wash", i: 5, blur: false, colour: false },
  ];
  return (
    <div className="grid gap-r4">
      <Button variant="secondary" iconStart={<RotateCcw />} className="justify-self-start" onClick={() => setRound(round + 1)}>
        Load again
      </Button>
      <div className={GRID} data-sc="image-slow">
        {cases.map(({ note, i, blur, colour }, n) => (
          <figure key={`${round}-${n}`} className="grid gap-r5">
            <SlowImage
              {...props(i)}
              // A fresh address each round: a picture already in the memory cache is complete
              // at once and shown without the fade (a fragment would not do: that cache ignores it).
              src={round === 0 ? photo(i).src : `${photo(i).src}${photo(i).src.includes("?") ? "&" : "?"}replay=${round}`}
              delay={1200 + n * 600}
              placeholder={blur ? photo(i).placeholder : undefined}
              placeholderColor={colour ? photo(i).color : undefined}
              className="w-full"
            />
            <figcaption className="text-body-3 text-fg-muted">{note}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const RATIOS: ImageRatio[] = ["intrinsic", "wide", "classic", "square", "portrait"];
const RADII: ImageRadius[] = ["none", "sm", "md", "lg", "xl"];

export default function ImageSection() {
  return (
    <Stack>
      <Row label="Blur-up on a slow network (simulated: each address arrives after a delay), then a cross-fade">
        <SlowLoads />
      </Row>
      <Row label="Ratios: the file's own (8:5 here), wide, classic, square, portrait · cover, then contain in a square">
        <div className={GRID} data-sc="image-ratios">
          {RATIOS.map((ratio) => (
            <figure key={ratio} className="grid gap-r5">
              <Image {...props(0)} ratio={ratio} placeholderColor={photo(0).color} className="w-full" />
              <figcaption className="text-body-3 text-fg-muted">{ratio}</figcaption>
            </figure>
          ))}
          <figure className="grid gap-r5">
            <Image {...props(1)} ratio="square" fit="contain" className="w-full" />
            <figcaption className="text-body-3 text-fg-muted">square, contain</figcaption>
          </figure>
        </div>
      </Row>
      <Row label="Radius from the scale: none, sm, md (default), lg, xl">
        <div className={GRID}>
          {RADII.map((radius) => (
            <Image key={radius} {...props(7)} ratio="square" radius={radius} placeholderColor={photo(7).color} className="w-full" />
          ))}
        </div>
      </Row>
      <Row label="Failed to load: the glyph and the alt text · decorative (glyph only) · a long alt in a small box">
        <div className={GRID} data-sc="image-errors">
          <Image src={BROKEN} alt="Crew photo from the launch party" width={1200} height={800} className="w-full" />
          <Image src={BROKEN} alt="" width={1200} height={800} className="w-full" />
          <Image
            src={BROKEN}
            alt="A wide panorama of the whole valley from the northern ridge, taken an hour before sunrise with the river still in shadow"
            width={1000}
            height={1000}
            ratio="square"
            className="w-1/2"
          />
        </div>
      </Row>
      <Row label="Width capped at the file's own, like a plain img (a 160 × 120 file) · priority (eager, high fetch priority)">
        <div className="flex flex-wrap items-start gap-r3">
          <Image {...props(5)} width={160} height={120} placeholderColor={photo(5).color} />
          <Image {...props(3)} priority placeholder={photo(3).placeholder} className="w-column-md max-w-full" />
        </div>
      </Row>
      <Row label="Compact density and RTL: the fallback's text and glyph follow">
        <div data-density="compact" dir="rtl" className={GRID}>
          <Image {...props(9)} alt="نهر جليدي" placeholder={photo(9).placeholder} className="w-full" />
          <Image src={BROKEN} alt="صورة الفريق في حفل الإطلاق" width={1200} height={800} className="w-full" />
        </div>
      </Row>
    </Stack>
  );
}
