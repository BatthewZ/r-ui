import type { ReactNode } from "react";

import { NavigationMenu, RouterProvider } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";
import { longItems, rtlItems, saasItems } from "./parts/site-nav";

export const meta = {
  title: "NavigationMenu",
  group: "marketing",
  order: 12,
  description:
    "Site navigation as APG disclosure navigation (links, never a menu): buttons open a dropdown or a mega panel of columns and a featured card, in place and in the top layer. Tab walks into an open panel, Escape returns to its button, the arrows move along the bar and down into a panel; a fine pointer opens a panel after a short rest and crosses the gap on a bridge; one panel at a time. The current page is marked from the RouterProvider.",
};

const BASE = "#/overview/marketing-navigationmenu";

/** Marks one page current, as an app's router would. */
const current = (href: string) => href === `${BASE}/product/analytics` || href === `${BASE}/pricing`;

/** A bar for the menu to sit in; the menu fills it, so a mega panel spans the bar. */
const Bar = ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
  <div className="flex min-w-0 items-center rounded-md border border-border bg-canvas px-r3 py-r4" {...props}>
    {children}
  </div>
);

export default function NavigationMenuSection() {
  return (
    <Stack>
      <Row label="Mega panel (Product: three titled columns + a featured card), a dropdown (Resources), plain links · Analytics and Pricing are the current pages, so Product carries the marker too">
        <RouterProvider isCurrent={current}>
          <Bar data-testid="nm-basic">
            <NavigationMenu className="flex-1" items={saasItems(BASE)} />
          </Bar>
        </RouterProvider>
      </Row>
      <Row label="Compact density · the panels open compact (they render in place)">
        <Bar data-testid="nm-compact" data-density="compact">
          <NavigationMenu className="flex-1" items={saasItems(BASE)} labels={{ navigation: "Main (compact)" }} />
        </Bar>
      </Row>
      <Row label="Long labels and an unbroken word: the bar's labels truncate, a panel's links wrap">
        <Bar data-testid="nm-long">
          <NavigationMenu className="flex-1" items={longItems(BASE)} labels={{ navigation: "Hauptnavigation" }} />
        </Bar>
      </Row>
      <Row label="RTL · panels open from the inline start, Left and Right mirrored">
        <Bar data-testid="nm-rtl" dir="rtl">
          <NavigationMenu className="flex-1" items={rtlItems(BASE)} labels={{ navigation: "الرئيسية" }} />
        </Bar>
      </Row>
      <Row label="Empty: no items, an empty named navigation (nothing to show, nothing to tab to)">
        <Bar data-testid="nm-empty">
          <NavigationMenu className="flex-1" items={[]} labels={{ navigation: "Empty" }} />
        </Bar>
      </Row>
    </Stack>
  );
}
