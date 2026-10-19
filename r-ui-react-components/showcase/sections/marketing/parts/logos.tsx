import type { ReactElement } from "react";

import corvid from "./logo-corvid.svg";
import halden from "./logo-halden.svg";
import northpine from "./logo-northpine.svg";

/**
 * A mark beside a wordmark, drawn in `currentColor`, so the cloud's ink paints it. A
 * logo is a picture: it stays left to right in an RTL page, and its word is fitted to
 * its box (`textLength`), so no theme's face can push it past the edge.
 */
function Wordmark({ name, mark }: { name: string; mark: ReactElement }) {
  const word = Math.round(name.length * 11);
  return (
    <svg role="img" aria-label={name} viewBox={`0 0 ${46 + word} 40`} fill="currentColor" direction="ltr">
      {mark}
      <text x="42" y="27" fontSize="19" fontWeight="600" textLength={word} lengthAdjust="spacingAndGlyphs">
        {name}
      </text>
    </svg>
  );
}

const MARKS: { name: string; mark: ReactElement }[] = [
  { name: "Tessellate", mark: <path d="M6 8h12v12H6zM20 20h12v12H20zM20 8h12v10H20z" /> },
  { name: "Brightwater", mark: <path d="M4 26c6-8 10-8 16 0s10 8 16 0v6c-6 8-10 8-16 0s-10-8-16 0z" /> },
  { name: "Marrow & Fig", mark: <circle cx="20" cy="20" r="13" /> },
  { name: "Quillstone", mark: <path d="M8 32 30 8l4 4-22 24H8z" /> },
  { name: "Lumen Rail", mark: <path d="M6 30h28v4H6zM10 8h4v20h-4zM26 8h4v20h-4z" /> },
];

/** Inline SVG wordmarks in `currentColor`: monochrome by the cloud's ink. */
export const INLINE_LOGOS = MARKS.map((logo) => <Wordmark key={logo.name} {...logo} />);

/** Colour image logos (`<img>` with alt text): monochrome by the cloud's filter until hovered. */
export const IMAGE_LOGOS = [
  { src: halden, alt: "Halden Labs", width: 168 },
  { src: northpine, alt: "Northpine", width: 150 },
  { src: corvid, alt: "Corvid Health", width: 176 },
].map(({ src, alt, width }) => <img key={alt} src={src} alt={alt} width={width} height={40} />);
