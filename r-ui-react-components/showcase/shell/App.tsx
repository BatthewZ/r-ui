import { FlaskConical, Gauge, LayoutGrid, Megaphone } from "lucide-react";
import { type ComponentType, lazy, type ReactNode, Suspense, useCallback, useEffect } from "react";

import { AppShell, RouterProvider } from "../../src/components/navigation";
import { ToastProvider } from "../../src/components/overlays";
import { DocumentTitleProvider, useDocumentTitle } from "../../src/hooks/use-document-title";
import { CommandMenu } from "./CommandMenu";
import { href, useHashRoute } from "./router";
import { ViewPanel } from "./ViewPanel";

export interface PageProps {
  /** The in-page anchor from the hash (`#/overview/<anchor>`), if any. */
  anchor: string | null;
}

// Each page is its own chunk: a first visit to the Dashboard does not load the
// Overview's sixty demos, nor the other way round.
const Overview = lazy(() => import("../pages/Overview").then((m) => ({ default: m.Overview })));
const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Marketing = lazy(() => import("../pages/Marketing").then((m) => ({ default: m.Marketing })));
const Stress = lazy(() => import("../pages/Stress").then((m) => ({ default: m.Stress })));

const ROUTES: { page: string; label: string; Icon: ComponentType<{ className?: string }>; Page: ComponentType<PageProps> }[] = [
  { page: "overview", label: "Overview", Icon: LayoutGrid, Page: Overview },
  { page: "dashboard", label: "Dashboard", Icon: Gauge, Page: Dashboard },
  { page: "marketing", label: "Marketing", Icon: Megaphone, Page: Marketing },
  { page: "stress", label: "Stress", Icon: FlaskConical, Page: Stress },
];

const FALLBACK = "overview";

/**
 * The showcase is a consumer app, so its frame is the library's own AppShell:
 * a full sidebar on wide screens, an icon rail on medium ones and a bottom nav
 * with every page on phones. The header keeps a home link (the sidebar's brand
 * is gone on phones) and the View panel.
 */
export function App() {
  const { page, anchor } = useHashRoute(FALLBACK);
  const route = ROUTES.find((r) => r.page === page) ?? ROUTES[0]!;

  // A new page starts at the top; an anchor is the page's own business.
  useEffect(() => {
    if (!anchor) window.scrollTo({ top: 0 });
  }, [route.page, anchor]);

  const { Page } = route;
  // The app root owns the toast stack, as a consumer app's would: any page or
  // demo calls `useToast()`, and no section depends on another for a provider.
  return (
    <DocumentTitleProvider base="r-ui showcase" separator=" · ">
      <ToastProvider>
        <AppShell>
          <ShellNav current={route.page}>
            <AppShell.Sidebar label="Showcase">
              <AppShell.Brand href={href(FALLBACK)} mark={<span className="font-mono">r</span>}>
                r-ui <span className="font-normal text-fg-muted">showcase</span>
              </AppShell.Brand>
              <AppShell.SidebarSection title="Pages">{navItems}</AppShell.SidebarSection>
              <AppShell.SidebarSection position="end">
                <AppShell.SidebarToggle />
              </AppShell.SidebarSection>
            </AppShell.Sidebar>
          </ShellNav>
          <AppShell.Header className="sc-topbar">
            <a className="sc-home md:hidden" href={href(FALLBACK)}>
              <span className="sc-home-mark" aria-hidden>
                r
              </span>
              r-ui <span className="font-normal text-fg-muted">showcase</span>
            </a>
            <CommandMenu pages={ROUTES} />
            <ViewPanel />
          </AppShell.Header>
          {/* The padding steps the Marketing page cancels to run its bands edge to edge. */}
          <AppShell.Main className="px-r2 py-r1 md:p-r1">
            <PageTitle label={route.label} />
            <Suspense fallback={<p className="text-body-2 text-fg-muted">Loading…</p>}>
              <Page anchor={anchor} />
              <PageReady page={route.page} />
            </Suspense>
          </AppShell.Main>
          <ShellNav current={route.page}>
            <AppShell.BottomNav label="Showcase" data-showcase-bottomnav="">
              {navItems}
            </AppShell.BottomNav>
          </ShellNav>
        </AppShell>
      </ToastProvider>
    </DocumentTitleProvider>
  );
}

const navItems = ROUTES.map(({ page, label, Icon }) => (
  <AppShell.NavItem key={page} href={href(page)} icon={<Icon aria-hidden />}>
    {label}
  </AppShell.NavItem>
));

/**
 * The router configuration for the shell's own navigation. Scoped to it, not the
 * whole app: the pages are specimens whose placeholder links point back at the
 * page they sit on, and a real router would rightly call those current.
 */
function ShellNav({ current, children }: { current: string; children: ReactNode }) {
  const isCurrent = useCallback((target: string) => target === href(current), [current]);
  return <RouterProvider isCurrent={isCurrent}>{children}</RouterProvider>;
}

/**
 * `<html data-showcase-ready="<page>">` once the page and everything it suspends
 * on (its chunk, the Overview's sections) have committed. The browser checks
 * wait for it rather than for an element that a slow first load may not have
 * rendered yet.
 */
function PageReady({ page }: { page: string }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.showcaseReady = page;
    return () => {
      delete root.dataset.showcaseReady;
    };
  }, [page]);
  return null;
}

function PageTitle({ label }: { label: string }) {
  useDocumentTitle(label);
  return null;
}
