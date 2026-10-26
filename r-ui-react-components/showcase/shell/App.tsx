import { Blocks, FlaskConical, Gauge, LayoutGrid, Megaphone } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type ComponentType,
  Fragment,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
} from "react";

import { AppShell, RouterProvider } from "../../src/components/navigation";
import { DropdownMenu, ToastProvider } from "../../src/components/overlays";
import { DocumentTitleProvider, useDocumentTitle } from "../../src/hooks/use-document-title";
import { categoryIndex, sectionIndex } from "../registry";
import { CommandMenu } from "./CommandMenu";
import { groupIcon } from "./group-icons";
import { href, useHashRoute } from "./router";
import { groupTitle, resolveOverview } from "./sections";
import { ViewBridge } from "./ViewBridge";
import { ViewPanel } from "./ViewPanel";

export interface PageProps {
  /** The hash's second segment (`#/overview/<anchor>`), if any: a group, a section, a list, as the page reads it. */
  anchor: string | null;
}

// Each page is its own chunk: a first visit to the Dashboard does not load a
// group's demos, nor the other way round.
const Overview = lazy(() => import("../pages/Overview").then((m) => ({ default: m.Overview })));
const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Marketing = lazy(() => import("../pages/Marketing").then((m) => ({ default: m.Marketing })));
const Stress = lazy(() => import("../pages/Stress").then((m) => ({ default: m.Stress })));

const Solo = lazy(() => import("../pages/Solo").then((m) => ({ default: m.Solo })));
const All = lazy(() => import("../pages/All").then((m) => ({ default: m.All })));

interface PageRoute {
  page: string;
  label: string;
  Page: ComponentType<PageProps>;
}

const ROUTES: (PageRoute & { Icon: ComponentType<{ className?: string }> })[] = [
  { page: "overview", label: "Overview", Icon: LayoutGrid, Page: Overview },
  { page: "dashboard", label: "Dashboard", Icon: Gauge, Page: Dashboard },
  { page: "marketing", label: "Marketing", Icon: Megaphone, Page: Marketing },
  { page: "stress", label: "Stress", Icon: FlaskConical, Page: Stress },
];

/**
 * Pages outside the navigation, for the browser checks: chosen sections alone
 * (`#/solo/<id>,…`), every section on one page (`#/all`, for the sweeps), and an
 * empty page a check resets to, which costs no section's load.
 */
const HIDDEN_ROUTES: PageRoute[] = [
  { page: "solo", label: "Solo", Page: Solo },
  { page: "all", label: "All sections", Page: All },
  { page: "blank", label: "Blank", Page: () => null },
];

const FALLBACK = "overview";

/**
 * The showcase is a consumer app, so its frame is the library's own AppShell:
 * a full sidebar on wide screens, an icon rail on medium ones and a bottom nav
 * with every page and a Components menu on phones. The header keeps a home link (the sidebar's brand
 * is gone on phones) and the View panel.
 */
export function App() {
  const { page, anchor } = useHashRoute(FALLBACK);
  const route: PageRoute = ROUTES.find((r) => r.page === page) ?? HIDDEN_ROUTES.find((r) => r.page === page) ?? ROUTES[0]!;

  // A new page starts at the top; an anchor is the page's own business.
  useEffect(() => {
    if (!anchor) window.scrollTo({ top: 0 });
  }, [route.page, anchor]);

  // On a group's page (`#/overview/<group or section>`), the group is what is current.
  const target = route.page === "overview" ? resolveOverview(sectionIndex, anchor) : null;
  const group = target?.kind === "group" ? target.group : null;
  const current = group ? href("overview", group) : href(route.page);

  const { Page } = route;
  // The app root owns the toast stack, as a consumer app's would: any page or
  // demo calls `useToast()`, and no section depends on another for a provider.
  return (
    <DocumentTitleProvider base="r-ui showcase" separator=" · ">
      <ViewBridge />
      <ToastProvider>
        <AppShell>
          <ShellNav current={current}>
            <AppShell.Sidebar label="Showcase">
              <AppShell.Brand href={href(FALLBACK)} mark={<span className="font-mono">r</span>}>
                r-ui <span className="font-normal text-fg-muted">showcase</span>
              </AppShell.Brand>
              <AppShell.SidebarSection title="Pages">{navItems}</AppShell.SidebarSection>
              {categoryIndex.map(({ title, groups }) => (
                <AppShell.SidebarSection key={title} title={title}>
                  {groups.map(({ group }) => groupItem(group))}
                </AppShell.SidebarSection>
              ))}
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
            <PageTitle label={group ? groupTitle(group) : route.label} />
            <Suspense fallback={<p className="text-body-2 text-fg-muted">Loading…</p>}>
              <Page anchor={anchor} />
              <PageReady page={route.page} />
            </Suspense>
          </AppShell.Main>
          <ShellNav current={current}>
            <AppShell.BottomNav label="Showcase" data-showcase-bottomnav="">
              {navItems[0]}
              <AppShell.NavItem as={ComponentsMenuButton} icon={<Blocks aria-hidden />} current={group !== null}>
                Components
              </AppShell.NavItem>
              {navItems.slice(1)}
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

/** A component group's page in the sidebar; on phones the bottom nav's Components menu lists them. */
function groupItem(group: string) {
  const Icon = groupIcon(group);
  return (
    <AppShell.NavItem key={group} href={href("overview", group)} icon={<Icon aria-hidden />}>
      {groupTitle(group)}
    </AppShell.NavItem>
  );
}

/**
 * The bottom nav's Components tab: a menu button listing each group's page, as
 * the sidebar does on wider screens. The tab renders it as its own element, so
 * the menu stays inside the tab's list item.
 */
function ComponentsMenuButton({ children, ...props }: ComponentPropsWithRef<"button">) {
  return (
    <DropdownMenu placement="top-end">
      <DropdownMenu.Trigger asChild>
        <button type="button" {...props}>
          {children}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        {categoryIndex.map(({ title, groups }, i) => (
          <Fragment key={title}>
            {i > 0 && <DropdownMenu.Separator />}
            <DropdownMenu.Label>{title}</DropdownMenu.Label>
            {groups.map(({ group }) => {
              const Icon = groupIcon(group);
              return (
                <DropdownMenu.Item
                  key={group}
                  icon={<Icon />}
                  onSelect={() => (window.location.hash = href("overview", group))}
                >
                  {groupTitle(group)}
                </DropdownMenu.Item>
              );
            })}
          </Fragment>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/**
 * The router configuration for the shell's own navigation, `current` being the
 * href that is current. Scoped to it, not the whole app: the pages are specimens
 * whose placeholder links point back at the page they sit on, and a real router
 * would rightly call those current.
 */
function ShellNav({ current, children }: { current: string; children: ReactNode }) {
  const isCurrent = useCallback((target: string) => target === current, [current]);
  return <RouterProvider isCurrent={isCurrent}>{children}</RouterProvider>;
}

/**
 * `<html data-showcase-ready="<page>">` once the page and everything it suspends
 * on (its chunk, a group's sections) have committed. The browser checks
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
