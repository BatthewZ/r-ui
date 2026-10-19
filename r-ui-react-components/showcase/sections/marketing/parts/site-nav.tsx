import { BarChart3, BookOpen, Code2, GitBranch, LifeBuoy, Newspaper, PenLine, Rocket, ShieldCheck, Workflow } from "lucide-react";
import type { ReactNode } from "react";

import { Button, type NavigationMenuItem } from "../../../../src";
import kiln from "../../../pages/marketing/art/kiln.svg";

/** The SiteHeader and NavigationMenu demos' data. Kept in a subfolder, which the section registry does not glob. */

export const brandMark = (href: string, name = "Kilnworks") => (
  <a href={href} className="inline-flex min-w-0 items-center gap-r5 rounded-md text-h5 font-semibold text-fg-primary no-underline">
    <span aria-hidden className="inline-flex size-icon shrink-0 items-center justify-center rounded-sm bg-primary text-body-3 text-fg-on-primary">
      K
    </span>
    <span className="min-w-0 truncate">{name}</span>
  </a>
);

const Featured = ({ href, title, body }: { href: string; title: ReactNode; body: ReactNode }) => (
  <a
    href={href}
    className="flex h-full min-w-0 flex-col gap-r5 rounded-md border border-border bg-surface-1 p-r4 text-fg-primary no-underline hover:border-border-strong"
  >
    <img src={kiln} alt="" width={1600} height={900} className="aspect-video w-full rounded-sm object-cover" />
    <span className="font-medium break-words">{title}</span>
    <span className="text-body-2 break-words text-fg-secondary">{body}</span>
  </a>
);

/** A SaaS site: a mega Product panel (columns + featured), a Resources dropdown, plain links. */
export function saasItems(base: string): NavigationMenuItem[] {
  return [
    {
      id: "product",
      label: "Product",
      columns: [
        {
          id: "write",
          title: "Write",
          links: [
            { label: "Editor", href: `${base}/product/editor`, description: "Draft release notes together, in real time.", icon: <PenLine /> },
            { label: "Workflows", href: `${base}/product/workflows`, description: "Review, approve and schedule.", icon: <Workflow /> },
          ],
        },
        {
          id: "measure",
          title: "Measure",
          links: [
            { label: "Analytics", href: `${base}/product/analytics`, description: "Who read what, and what they did next.", icon: <BarChart3 /> },
            { label: "Security", href: `${base}/product/security`, description: "SSO, audit logs and data residency.", icon: <ShieldCheck /> },
          ],
        },
        {
          id: "ship",
          title: "Ship",
          links: [
            { label: "Releases", href: `${base}/product/releases`, description: "Publish everywhere at once.", icon: <Rocket /> },
            { label: "Integrations", href: `${base}/product/integrations`, description: "GitHub, Linear, Slack and 40 more.", icon: <GitBranch /> },
          ],
        },
      ],
      featured: (
        <Featured href={`${base}/changelog`} title="What's new in 4.2" body="Scheduled exports, a faster editor and a new API." />
      ),
    },
    {
      id: "resources",
      label: "Resources",
      links: [
        { label: "Documentation", href: `${base}/docs`, icon: <BookOpen /> },
        { label: "Blog", href: `${base}/blog`, icon: <Newspaper /> },
        { label: "Support", href: `${base}/support`, icon: <LifeBuoy /> },
      ],
    },
    { id: "customers", label: "Customers", href: `${base}/customers` },
    { id: "pricing", label: "Pricing", href: `${base}/pricing` },
  ];
}

export const saasActions = (
  <>
    <Button variant="ghost">Sign in</Button>
    <Button>Start free</Button>
  </>
);

/** A docs site: guides as a dropdown, the API reference current, an external link. */
export function docsItems(base: string): NavigationMenuItem[] {
  return [
    {
      id: "guides",
      label: "Guides",
      links: [
        { label: "Getting started", href: `${base}/guides/start`, description: "Install, configure, publish your first note." },
        { label: "Theming", href: `${base}/guides/theming`, description: "One CSS file of custom properties." },
        { label: "Deploying", href: `${base}/guides/deploy` },
      ],
    },
    { id: "api", label: "API reference", href: `${base}/api` },
    { id: "examples", label: "Examples", href: `${base}/examples` },
    { id: "source", label: "Source", href: "https://example.com/kilnworks" },
  ];
}

export const docsActions = (
  <Button variant="secondary" iconStart={<Code2 />}>
    v4.2
  </Button>
);

/** Long labels, ~30% longer than English, and a word that does not break on its own. */
export function longItems(base: string): NavigationMenuItem[] {
  return [
    {
      id: "produkt",
      label: "Produktübersicht",
      links: [
        {
          label: "Versionshinweisverwaltungswerkzeug",
          href: `${base}/produkt/werkzeug`,
          description: "Donaudampfschifffahrtsgesellschaftskapitänsmützenaufbewahrungsrichtlinien, einmal erklärt.",
        },
        { label: "Zusammenarbeit in Echtzeit", href: `${base}/produkt/zusammenarbeit` },
      ],
    },
    { id: "preise", label: "Preise und Pakete", href: `${base}/preise` },
    { id: "kunden", label: "Kundengeschichten", href: `${base}/kunden` },
  ];
}

/** The SaaS navigation in Arabic, for right-to-left demos. */
export function rtlItems(base: string): NavigationMenuItem[] {
  return [
    {
      id: "product",
      label: "المنتج",
      columns: [
        {
          id: "write",
          title: "الكتابة",
          links: [
            { label: "المحرر", href: `${base}/product/editor`, description: "صياغة ملاحظات الإصدار معًا.", icon: <PenLine /> },
            { label: "سير العمل", href: `${base}/product/workflows`, icon: <Workflow /> },
          ],
        },
        {
          id: "ship",
          title: "النشر",
          links: [{ label: "الإصدارات", href: `${base}/product/releases`, icon: <Rocket /> }],
        },
      ],
    },
    {
      id: "resources",
      label: "الموارد",
      links: [
        { label: "التوثيق", href: `${base}/docs` },
        { label: "المدونة", href: `${base}/blog` },
      ],
    },
    { id: "pricing", label: "الأسعار", href: `${base}/pricing` },
  ];
}
