import { type CSSProperties, useEffect, useLayoutEffect, useState } from "react";

import { LocaleProvider } from "../../src";
import type { PageProps } from "../shell/App";
import { useShowcaseBar } from "../shell/bars";
import { ClosingCta, SiteFooter } from "./marketing/Closing";
import { type Region } from "./marketing/content";
import { Customers } from "./marketing/Customers";
import { Faq } from "./marketing/Faq";
import { Details, Features, Steps } from "./marketing/Features";
import { PageHeader } from "./marketing/Header";
import { PageHero } from "./marketing/Hero";
import { Journal, JournalPosts } from "./marketing/Journal";
import { PricingSection } from "./marketing/Pricing";

/**
 * A landing page for a fictional product, built from the library as a site
 * would be: the marketing and media groups for every section, the layout group
 * for the fluid display scale and section rhythm, and ordinary UI components
 * inside it at UI scale. The root is a size container, so every `cqi`-fluid
 * token (display type, section rhythm, gutter) sizes to the page column, not
 * the window.
 *
 * The negative margins undo the showcase shell's own padding around `<main>`
 * (`--R-SIZE-2` inline when narrow, `--R-SIZE-1` from 48rem, `--R-SIZE-1`
 * block), so the bands run edge to edge as they would on a real site.
 *
 * The footer's region switcher drives a `LocaleProvider` around the page, so
 * prices, figures and dates follow it.
 *
 * `isolate`: the page's sticky layer (its site header) stacks inside the page,
 * so the header, hidden by sliding up, passes under the showcase's bar.
 */
export function Marketing({ anchor }: PageProps) {
  const [region, setRegion] = useState<Region>("en-US");
  const shellTop = useShowcaseBar("top");

  // The document scrolls under two sticky bars, the showcase's and the site
  // header; an anchor or focus scrolled into view clears both.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const before = root.style.scrollPaddingBlockStart;
    root.style.scrollPaddingBlockStart = `calc(${shellTop}px + var(--r-marketing-site-header-h))`;
    return () => {
      root.style.scrollPaddingBlockStart = before;
    };
  }, [shellTop]);

  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }, [anchor]);

  return (
    <LocaleProvider locale={region}>
      <div
        data-mkt="page"
        className="@container isolate -mx-r2 -my-r1 bg-canvas md:-mx-r1"
        style={{ "--mkt-shell-top": `${shellTop}px` } as CSSProperties}
      >
        <PageHeader />
        <PageHero />
        <Features />
        <Steps />
        <Details />
        <Customers />
        <Journal />
        <JournalPosts />
        <PricingSection />
        <Faq />
        <ClosingCta />
        <SiteFooter region={region} onRegionChange={setRegion} />
      </div>
    </LocaleProvider>
  );
}
