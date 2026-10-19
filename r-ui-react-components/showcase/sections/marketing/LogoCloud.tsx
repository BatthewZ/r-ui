import { LogoCloud } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";
import { IMAGE_LOGOS, INLINE_LOGOS } from "./parts/logos";

export const meta = {
  title: "LogoCloud",
  group: "marketing",
  order: 35,
  description:
    "A quiet row of customer logos: monochrome by default (images through a filter, inline SVGs in the secondary ink), display-scale tall. The optional marquee loops them slowly with a pause toggle, holds still under the pointer and on focus, keeps the copies away from assistive tech and the keyboard, and stands still as a wrapped grid under reduced motion.",
};

/** A broken image: an undecodable data URI fails silently (a 404 would log), leaving its alt text. */
const BROKEN = <img src="data:image/png;base64,AAAA" alt="Northwind Freight" width={150} height={40} />;

/** A marquee clips two loops of its logos by design: its demos carry `data-sc-scrolls`. */
export default function LogoCloudSection() {
  return (
    <Stack>
      <Row label="Logo grid · inline SVGs in currentColor · wraps, centred">
        <div data-sc="logos-grid">
          <LogoCloud title="Trusted by release teams at">{INLINE_LOGOS}</LogoCloud>
        </div>
      </Row>
      <Row label="Colour images, monochrome until hovered (colorOnHover) · one broken image keeps its alt text">
        <div data-sc="logos-images">
          <LogoCloud title="Teams shipping with Kiln" colorOnHover>
            {IMAGE_LOGOS}
            {BROKEN}
          </LogoCloud>
        </div>
      </Row>
      <Row label="Marquee · pause toggle · holds under the pointer and on focus · a wrapped grid under reduced motion">
        <div data-sc="logos-marquee" data-sc-scrolls>
          <LogoCloud title="Trusted by release teams at" marquee>
            {INLINE_LOGOS}
            {IMAGE_LOGOS}
          </LogoCloud>
        </div>
      </Row>
      <Row label="Marquee of links (each opens its customer story) · keyboard focus brings a logo into view">
        <div data-sc="logos-marquee-links" data-sc-scrolls>
          <LogoCloud title="Read their stories" marquee={48} colorOnHover>
            {IMAGE_LOGOS.map((logo) => (
              <a key={logo.key} href="#/overview/marketing-logocloud" className="rounded-md">
                {logo}
              </a>
            ))}
          </LogoCloud>
        </div>
      </Row>
      <Row label="RTL · compact density · no title (the list is named by its label)">
        <div data-sc="logos-rtl" dir="rtl" data-density="compact" data-sc-scrolls>
          <LogoCloud marquee labels={{ list: "عملاؤنا", pause: "إيقاف الشعارات المتحركة" }}>
            {INLINE_LOGOS}
          </LogoCloud>
        </div>
      </Row>
      <Row label="Narrow box (a column) · marquee">
        <div data-sc="logos-narrow" className="w-column-md max-w-full" data-sc-scrolls>
          <LogoCloud marquee>{INLINE_LOGOS.slice(0, 3)}</LogoCloud>
        </div>
      </Row>
      <Row label="Empty: no logos renders nothing (nothing below this line)">
        <div data-sc="logos-empty">
          <LogoCloud title="Trusted by" marquee />
        </div>
      </Row>
    </Stack>
  );
}
