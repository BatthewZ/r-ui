import { FlaskConical, Gauge, LayoutGrid, Megaphone } from "lucide-react";
import { type ComponentType, useEffect } from "react";

import { ToastProvider } from "../../src/components/overlays";
import { Dashboard } from "../pages/Dashboard";
import { Marketing } from "../pages/Marketing";
import { Overview } from "../pages/Overview";
import { Stress } from "../pages/Stress";
import { href, useHashRoute } from "./router";
import { ViewPanel } from "./ViewPanel";

export interface PageProps {
  /** The in-page anchor from the hash (`#/overview/<anchor>`), if any. */
  anchor: string | null;
}

const ROUTES: { page: string; label: string; Icon: ComponentType<{ className?: string }>; Page: ComponentType<PageProps> }[] = [
  { page: "overview", label: "Overview", Icon: LayoutGrid, Page: Overview },
  { page: "dashboard", label: "Dashboard", Icon: Gauge, Page: Dashboard },
  { page: "marketing", label: "Marketing", Icon: Megaphone, Page: Marketing },
  { page: "stress", label: "Stress", Icon: FlaskConical, Page: Stress },
];

const FALLBACK = "overview";

export function App() {
  const { page, anchor } = useHashRoute(FALLBACK);
  const route = ROUTES.find((r) => r.page === page) ?? ROUTES[0]!;

  useEffect(() => {
    document.title = `${route.label} · r-ui showcase`;
  }, [route.label]);

  // A new page starts at the top; an anchor is the page's own business.
  useEffect(() => {
    if (!anchor) window.scrollTo({ top: 0 });
  }, [route.page, anchor]);

  const { Page } = route;
  // The app root owns the toast stack, as a consumer app's would: any page or
  // demo calls `useToast()`, and no section depends on another for a provider.
  return (
    <ToastProvider>
      <div className="sc-shell">
        <a className="sc-skip" href="#main" onClick={skipToMain}>
          Skip to content
        </a>
        <header className="sc-topbar">
          <a className="sc-brand" href={href(FALLBACK)}>
            <span className="sc-brand-mark" aria-hidden>
              r
            </span>
            <span>
              r-ui <span className="sc-brand-sub">showcase</span>
            </span>
          </a>
          <ViewPanel />
        </header>
        <nav className="sc-nav" aria-label="Showcase">
          <ul>
            {ROUTES.map(({ page: p, label, Icon }) => (
              <li key={p}>
                <a href={href(p)} aria-current={p === route.page ? "page" : undefined}>
                  <Icon aria-hidden className="size-icon" />
                  <span>{label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <main className="sc-main" id="main" tabIndex={-1}>
          <Page anchor={anchor} />
        </main>
      </div>
    </ToastProvider>
  );
}

/** The hash belongs to the router, so the skip link moves focus itself. */
function skipToMain(event: React.MouseEvent) {
  event.preventDefault();
  document.getElementById("main")?.focus();
}
