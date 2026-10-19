import { GitMerge, ListOrdered, Rows3 } from "lucide-react";

import { Button, type NavigationMenuItem, SiteHeader } from "../../../src";
import { brandMark } from "../../sections/marketing/parts/site-nav";
import { href } from "../../shell/router";
import { PRODUCT } from "./content";

const ITEMS: NavigationMenuItem[] = [
  {
    id: "product",
    label: "Product",
    links: [
      { label: "Features", href: href("marketing", "features"), description: "Drafts, audiences and review.", icon: <GitMerge /> },
      { label: "How it works", href: href("marketing", "how-it-works"), description: "From merge to inbox in three steps.", icon: <ListOrdered /> },
      { label: "Compare plans", href: href("marketing", "compare"), description: "Every feature, plan by plan.", icon: <Rows3 /> },
    ],
  },
  { id: "customers", label: "Customers", href: href("marketing", "customers") },
  { id: "journal", label: "Journal", href: href("marketing", "journal") },
  { id: "pricing", label: "Pricing", href: href("marketing", "pricing") },
];

/**
 * The product's own bar: transparent over the hero, then solid, sliding away on
 * a scroll down and back on a scroll up. It sticks under the showcase's own top
 * bar (`--mkt-shell-top`, set by the page, as the header's offset), where a
 * site's header would stick at 0.
 */
export function PageHeader() {
  return (
    <SiteHeader
      variant="transparent"
      hideOnScroll
      brand={brandMark(href("marketing"), PRODUCT)}
      items={ITEMS}
      navigationProps={{ labels: { navigation: PRODUCT } }}
      actions={
        <>
          <Button variant="ghost">Sign in</Button>
          <Button>Start free</Button>
        </>
      }
      className="[--r-marketing-site-header-top:var(--mkt-shell-top)]"
    />
  );
}
