import type { SVGProps } from "react";

/** The r-ui mark: an arched r and the square unit it is built from. `currentColor`, so the brand chip paints it. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M5 6.25C5 5.56 5.56 5 6.25 5h2c.69 0 1.25.56 1.25 1.25v1A6 6 0 0 1 14.5 5h3.25c.69 0 1.25.56 1.25 1.25v2c0 .69-.56 1.25-1.25 1.25H14.5a5 5 0 0 0-5 5v3.25c0 .69-.56 1.25-1.25 1.25h-2C5.56 19 5 18.44 5 17.75Z" />
      <rect x="14.5" y="14.5" width="4.5" height="4.5" rx="1.25" />
    </svg>
  );
}
