import type { ReactNode } from "react";

import { Button, Hero, Link, RouterProvider, SiteHeader } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";
import { brandMark, docsActions, docsItems, longItems, rtlItems, saasActions, saasItems } from "./parts/site-nav";

export const meta = {
  title: "SiteHeader",
  group: "marketing",
  order: 11,
  description:
    "A marketing site's top bar: brand, NavigationMenu, calls to action. Below a width of its OWN it folds into a menu button whose drawer holds the same links as an accordion. Sticky, hide-on-scroll (never while focus or a panel is inside it), and a transparent variant over a hero that turns solid once its scroller moves. A skip link comes first; it never prints.",
};

const BASE = "#/overview/marketing-siteheader";

/** The pages an app's router would call current in these demos. */
const isCurrent = (href: string) => href === `${BASE}/api` || href === `${BASE}/product/analytics`;

/** A frame so the header's own edges show. */
const Frame = ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
  <div className="overflow-hidden rounded-lg border border-border bg-canvas" {...props}>
    {children}
  </div>
);

/** Filler after a header, so a frame reads as the top of a page. */
const Page = ({ id, children }: { id?: string; children?: ReactNode }) => (
  <div id={id} className="flex flex-col gap-r4 p-r2 text-body-1 text-fg-secondary">
    {children ?? <p>Page content starts here.</p>}
  </div>
);

const Prose = () => (
  <div className="prose mx-auto max-w-measure px-gutter py-section-3">
    <p>
      Scroll this box: the header slides away on the way down and comes back on any scroll up. Tab to{" "}
      <Link href={`${BASE}/hero/details`}>a link in the page</Link> while it is hidden and it stays hidden; Shift+Tab
      back into it and it returns.
    </p>
    {Array.from({ length: 6 }, (_, i) => (
      <p key={i}>
        Release notes your customers actually read: drafted from the pull requests you already merged, sorted by who each
        change affects, and published everywhere at once. Paragraph {i + 1} of 6.
      </p>
    ))}
    <p>
      <Button variant="secondary">A control below the fold</Button>
    </p>
  </div>
);

export default function SiteHeaderSection() {
  return (
    <Stack>
      <Row label="SaaS · mega menu (Product: columns + featured), a dropdown, plain links, two actions · a skip link first (Tab into the frame)">
        <Frame data-testid="sh-saas">
          <SiteHeader
            brand={brandMark(`${BASE}/home`)}
            items={saasItems(BASE)}
            actions={saasActions}
            skipTo="#sh-saas-main"
          />
          <Page id="sh-saas-main" />
        </Frame>
      </Row>
      <Row label="Docs · a guides dropdown, the API reference current, an external link, a version button · folds early (collapseBelow sm)">
        <RouterProvider isCurrent={isCurrent}>
          <Frame data-testid="sh-docs">
            <SiteHeader
              brand={brandMark(`${BASE}/docs`, "Kilnworks Docs")}
              items={docsItems(BASE)}
              actions={docsActions}
              collapseBelow="sm"
              navigationProps={{ labels: { navigation: "Documentation" } }}
            />
            <Page />
          </Frame>
        </RouterProvider>
      </Row>
      <Row label="Transparent over a band Hero, sticky, hideOnScroll, in its own scroller · the hero clears the bar with --r-marketing-site-header-h and sits on a contract surface, so the header's ink holds 4.5:1 transparent and solid">
        <div
          data-testid="sh-hero"
          // A demo's own scroller: on paper it lets go, full height.
          data-print="flow"
          className="h-[calc(var(--CONTROL-H)*12)] overflow-y-auto rounded-lg border border-border bg-canvas"
          style={{ scrollPaddingBlockStart: "var(--r-marketing-site-header-h)" }}
        >
          <SiteHeader
            variant="transparent"
            hideOnScroll
            brand={brandMark(`${BASE}/hero`)}
            items={saasItems(BASE)}
            actions={saasActions}
          />
          <Hero
            headingLevel={3}
            variant="band"
            className="pt-[calc(var(--r-marketing-site-header-h)+var(--SECTION-2))]"
            eyebrow="Release notes"
            title="Release notes your customers actually read."
            lead="Drafted from the pull requests you already merged, and published everywhere at once."
            actions={<Button>Start free</Button>}
          />
          <Prose />
        </div>
      </Row>
      <Row label="In a narrow box (--COLUMN-LG wide), whatever the viewport: brand and a menu button; the drawer holds the same links as an accordion (Product opens on the current page) and the actions">
        <RouterProvider isCurrent={isCurrent}>
          <div className="w-column-lg max-w-full">
            <Frame data-testid="sh-narrow">
              <SiteHeader brand={brandMark(`${BASE}/narrow`)} items={saasItems(BASE)} actions={saasActions} />
              <Page />
            </Frame>
          </div>
        </RouterProvider>
      </Row>
      <Row label="RTL · the brand on the right, panels and the drawer from the inline end">
        <Frame data-testid="sh-rtl" dir="rtl">
          <SiteHeader
            brand={brandMark(`${BASE}/rtl`, "كيلنووركس")}
            items={rtlItems(BASE)}
            actions={<Button>ابدأ مجانًا</Button>}
            labels={{ menu: "القائمة", skipToContent: "انتقل إلى المحتوى" }}
            navigationProps={{ labels: { navigation: "الرئيسية" } }}
          />
          <Page>
            <p>محتوى الصفحة يبدأ هنا.</p>
          </Page>
        </Frame>
      </Row>
      <Row label="Compact density · long labels and an unbroken word (collapseBelow lg)">
        <Frame data-testid="sh-compact" data-density="compact">
          <SiteHeader
            brand={brandMark(`${BASE}/compact`, "Versionshinweisverwaltungswerkzeug")}
            items={longItems(BASE)}
            actions={<Button>Kostenlos starten</Button>}
            collapseBelow="lg"
            labels={{ menu: "Menü" }}
            navigationProps={{ labels: { navigation: "Hauptnavigation" } }}
          />
          <Page />
        </Frame>
      </Row>
      <Row label="Empty: a brand alone (no navigation, no actions, so no menu button)">
        <Frame data-testid="sh-empty">
          <SiteHeader brand={brandMark(`${BASE}/empty`)} />
        </Frame>
      </Row>
    </Stack>
  );
}
