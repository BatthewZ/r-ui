import { useEffect } from "react";

import type { PageProps } from "../shell/App";
import { CtaBand, SiteFooter } from "./marketing/Closing";
import { Faq } from "./marketing/Faq";
import { Features } from "./marketing/Features";
import { PageHero, SiteHeader } from "./marketing/Hero";
import { Journal } from "./marketing/Journal";
import { Pricing } from "./marketing/Pricing";
import { JournalGrid, Testimonials } from "./marketing/Stories";

/**
 * A landing page for a fictional product, built from the same family as the
 * dashboard: Hero, MediaCard and Carousel from the marketing group, Section /
 * Container / Prose / Grid / Stack / Inline for the fluid display and section
 * rhythm, and the ordinary UI components inside it at UI scale. The root is a size container, so every `cqi`-fluid token (display
 * type, section rhythm, gutter) sizes to the page column, not the window.
 *
 * The negative margins undo the showcase shell's own padding around `<main>`
 * (`--R-SIZE-2` inline when narrow, `--R-SIZE-1` from 48rem, `--R-SIZE-1`
 * block), so the bands run edge to edge as they would on a real site.
 */
export function Marketing({ anchor }: PageProps) {
  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }, [anchor]);

  return (
    <div data-mkt="page" className="@container -mx-r2 -my-r1 bg-canvas md:-mx-r1">
      <SiteHeader />
      <PageHero />
      <Features />
      <Testimonials />
      <Journal />
      <JournalGrid />
      <Pricing />
      <Faq />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
