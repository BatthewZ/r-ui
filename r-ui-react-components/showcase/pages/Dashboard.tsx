import { Activity, FlaskConical, LayoutGrid, Megaphone, Rocket, ScrollText, Server, Settings, Target, TriangleAlert, Waypoints } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Banner } from "../../src/components/feedback";
import { FilterBar, type FilterValues } from "../../src/components/filters";
import { Grid, Stack } from "../../src/components/layout";
import { AppShell } from "../../src/components/navigation";
import { useToast } from "../../src/components/overlays";
import { Avatar, Link } from "../../src/components/primitives";
import { dateTimeFormatter, formatNumber } from "../../src/util/format";
import type { PageProps } from "../shell/App";
import { href } from "../shell/router";
import { CardBoundary } from "./dashboard/CardBoundary";
import { type Env, generate, INCIDENTS, MAINTENANCE } from "./dashboard/data";
import { CLOCK, FILTERS, fromAnchor, matchService, SERVICE_FILTER_IDS, toAnchor, viewOf } from "./dashboard/filters";
import { ago } from "./dashboard/format";
import { DashboardFrame } from "./dashboard/Frame";
import { HeaderActions } from "./dashboard/HeaderActions";
import { KpiRow } from "./dashboard/KpiRow";
import { ServicesCard } from "./dashboard/ServicesCard";
import { BudgetCard, DeploysCard, EndpointsCard, HeatmapCard, IncidentsCard, type Placement } from "./dashboard/SideCards";
import { TrafficCard } from "./dashboard/TrafficCard";
import { useExportJob } from "./dashboard/use-export-job";

type NavId = "overview" | "services" | "incidents" | "deploys" | "slos" | "logs" | "traces" | "settings";

interface NavEntry {
  id: NavId;
  label: string;
  icon: ReactNode;
  /** The card this destination scrolls to; absent = not part of the specimen. */
  target?: string;
  badge?: string;
}

const NAV: NavEntry[] = [
  { id: "overview", label: "Overview", icon: <LayoutGrid aria-hidden />, target: "dash-top" },
  { id: "services", label: "Services", icon: <Server aria-hidden />, target: "dash-services" },
  {
    id: "incidents",
    label: "Incidents",
    icon: <TriangleAlert aria-hidden />,
    target: "dash-incidents",
    badge: formatNumber(INCIDENTS.length),
  },
  { id: "deploys", label: "Deploys", icon: <Rocket aria-hidden />, target: "dash-deploys" },
  { id: "slos", label: "SLOs", icon: <Target aria-hidden />, target: "dash-slos" },
  { id: "logs", label: "Logs", icon: <ScrollText aria-hidden /> },
  { id: "traces", label: "Traces", icon: <Waypoints aria-hidden /> },
];
const SETTINGS: NavEntry = { id: "settings", label: "Settings", icon: <Settings aria-hidden /> };
const BOTTOM: NavEntry[] = [...NAV.slice(0, 4), SETTINGS];

const SHOWCASE = [
  { page: "overview", label: "Components", icon: <LayoutGrid aria-hidden /> },
  { page: "marketing", label: "Marketing page", icon: <Megaphone aria-hidden /> },
  { page: "stress", label: "Stress cases", icon: <FlaskConical aria-hidden /> },
];

/** A sticky header sits over the top of a scrolled-to card; keep the card clear of it. */
const SCROLL_MARGIN = "scroll-mt-[calc(var(--CONTROL-H)+var(--R-SIZE-3)*3)]";

/** How long a refresh takes to come back. */
const REFRESH_MS = 700;

/** Change it when the announcement changes, so a dismissal of an older one does not hide it. */
const MAINTENANCE_KEY = "kestrel:maintenance:2026-10-17";

const services = (n: number) => (n === 1 ? "1 service" : `${formatNumber(n)} services`);

/**
 * The view (filters and environment) in the page's hash anchor, both ways:
 * written with `replaceState` as it changes (no history entry per keystroke),
 * and read back when the hash moves from outside (back, a pasted link).
 */
function useViewInHash(anchor: string | null) {
  const [values, setValues] = useState<FilterValues>(() => fromAnchor(anchor).values);
  const [env, setEnv] = useState<Env>(() => fromAnchor(anchor).env);
  const written = useRef(anchor ?? "");

  useEffect(() => {
    const next = anchor ?? "";
    if (next === written.current) return;
    written.current = next;
    const read = fromAnchor(anchor);
    setValues(read.values);
    setEnv(read.env);
  }, [anchor]);

  useEffect(() => {
    const next = toAnchor(values, env);
    if (next === written.current) return;
    written.current = next;
    window.history.replaceState(window.history.state, "", href("dashboard", next || undefined));
  }, [values, env]);

  return { values, setValues, env, setEnv };
}

/**
 * The mockup's operations dashboard, rebuilt from library components only:
 * an AppShell (full sidebar / rail / bottom nav by viewport) whose header
 * holds a Toolbar (environment, actions); a maintenance Banner; a FilterBar
 * whose time range, regions, status, latency and search regenerate seeded data
 * and live in the URL; KPI tiles; traffic as a line chart and stacked error
 * columns; incidents as a Timeline; a services DataTable with detail rows,
 * columns menu, resizing, a pinned name, bulk actions and pages; meters; a
 * compact card whose rollout shows its progress; a 5xx heatmap. Each card has
 * its own ErrorBoundary. See `dashboard/Frame.tsx` for why it takes the whole
 * window.
 */
export function Dashboard({ anchor }: PageProps) {
  const { toast } = useToast();
  const { values, setValues, env, setEnv } = useViewInHash(anchor);
  const [current, setCurrent] = useState<NavId>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [fresh, setFresh] = useState(false);
  const refreshTimer = useRef<number | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);

  const { time, region } = values;
  const view = useMemo(() => viewOf({ time, region }), [time, region]);
  const data = useMemo(() => generate(view.window, view.regions, env), [view, env]);
  const rows = useMemo(() => data.services.filter((s) => matchService(s, values)), [data, values]);
  const resetKeys = [values, env];

  const exportJob = useExportJob((total) =>
    toast({
      title: "Export ready",
      description: `${services(total)}, ${view.phrase}.`,
      tone: "success",
      action: { label: "Download", onClick: () => toast({ title: "Downloaded services.csv" }) },
    }),
  );

  useEffect(() => {
    const timer = refreshTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const refresh = () => {
    window.clearTimeout(refreshTimer.current);
    setRefreshing(true);
    refreshTimer.current = window.setTimeout(() => {
      setRefreshing(false);
      setFresh(true);
      toast({ title: "Dashboard refreshed", description: "Every panel reloaded.", tone: "success" });
    }, REFRESH_MS);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied", description: `Opens this view: ${view.span}, ${env}.` });
    } catch {
      toast({ title: "Couldn't copy the link", description: window.location.href, tone: "warning" });
    }
  };

  const mute = () =>
    toast({
      title: "Alerts muted for 1 hour",
      description: "On-call will not be paged for this dashboard.",
      tone: "warning",
      action: { label: "Undo", onClick: () => toast({ title: "Alerts unmuted", tone: "success" }) },
    });

  const clearServiceFilters = () =>
    setValues((all) => Object.fromEntries(Object.entries(all).filter(([id]) => !SERVICE_FILTER_IDS.includes(id))));

  const go = (entry: NavEntry) => (event: MouseEvent) => {
    event.preventDefault();
    if (!entry.target) {
      toast({ title: `${entry.label} is not part of this specimen`, description: "The dashboard is one page deep." });
      return;
    }
    setCurrent(entry.id);
    document.getElementById(entry.target)?.scrollIntoView({ block: "start" });
  };
  const navItem = (entry: NavEntry) => (
    <AppShell.NavItem
      key={entry.id}
      href={`#${entry.id}`}
      onClick={go(entry)}
      current={current === entry.id}
      icon={entry.icon}
      badge={entry.badge}
    >
      {entry.label}
    </AppShell.NavItem>
  );

  /** A card in its own boundary: a fallback takes its place (and its scroll target) if it throws. */
  const guard = (title: string, placement: Placement, card: (placement: Placement) => ReactNode) => (
    <CardBoundary title={title} resetKeys={resetKeys} {...placement}>
      {card(placement)}
    </CardBoundary>
  );

  const maintenance = dateTimeFormatter(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(MAINTENANCE.start, MAINTENANCE.end);

  return (
    <DashboardFrame>
      <AppShell labels={{ skipLink: "Skip to dashboard" }}>
        <AppShell.Sidebar label="Kestrel Cloud">
          <AppShell.Brand href="#dash-top" onClick={go(NAV[0]!)} mark={<Activity aria-hidden />}>
            Kestrel Cloud
          </AppShell.Brand>
          <AppShell.SidebarSection title="Monitor">{NAV.slice(0, 5).map(navItem)}</AppShell.SidebarSection>
          <AppShell.SidebarSection title="Explore">{NAV.slice(5).map(navItem)}</AppShell.SidebarSection>
          <AppShell.SidebarSection title="r-ui showcase">
            {SHOWCASE.map((s) => (
              <AppShell.NavItem key={s.page} href={href(s.page)} icon={s.icon}>
                {s.label}
              </AppShell.NavItem>
            ))}
          </AppShell.SidebarSection>
          <AppShell.SidebarSection position="end">{navItem(SETTINGS)}</AppShell.SidebarSection>
          <AppShell.SidebarToggle />
        </AppShell.Sidebar>

        <AppShell.Header>
          {/* Focus lands here when the banner is dismissed. */}
          <h1 ref={heading} tabIndex={-1} className="min-w-0 truncate text-h2">
            Platform overview
          </h1>
          <HeaderActions
            env={env}
            onEnvChange={setEnv}
            onRefresh={refresh}
            onCopyLink={copyLink}
            onExport={() => exportJob.start(data.services.length)}
            onMute={mute}
          />
          <Avatar name="Bea Marsh" alt="Signed in as Bea Marsh" className="shrink-0" />
        </AppShell.Header>

        {/* The showcase page already owns <main>; a second main landmark is invalid. */}
        <AppShell.Main as="div">
          <Stack gap="r3" id="dash-top" className={SCROLL_MARGIN}>
            <Banner
              tone="info"
              title="Scheduled maintenance"
              dismissKey={MAINTENANCE_KEY}
              onDismiss={() => heading.current?.focus()}
              actions={
                <Link href="#status" onClick={(event) => event.preventDefault()}>
                  Status page
                </Link>
              }
              data-dashboard-banner=""
            >
              Database failover in {MAINTENANCE.region}, {maintenance}. Writes pause for up to five minutes; reads keep
              working.
            </Banner>

            <Stack gap="r5">
              <FilterBar
                filters={FILTERS}
                now={CLOCK}
                value={values}
                onValueChange={setValues}
                resultCount={rows.length}
                loading={refreshing}
                labels={{ results: services }}
                data-dashboard-filters=""
              />
              <p className="text-body-3 text-fg-muted">{fresh ? "Updated just now" : `Updated ${ago(2)}`}</p>
            </Stack>

            {guard("Key metrics", {}, () => <KpiRow data={data} view={view} />)}

            <Grid columns={{ base: 1, "@4xl": 3 }} className="items-start">
              {guard("Traffic", { className: "@4xl:col-span-2" }, (p) => <TrafficCard data={data} view={view} {...p} />)}
              {guard("Open incidents", { id: "dash-incidents", className: SCROLL_MARGIN }, (p) => <IncidentsCard {...p} />)}
            </Grid>

            <Grid columns={{ base: 1, "@4xl": 3 }} className="items-start">
              {guard("Services", { id: "dash-services", className: `${SCROLL_MARGIN} @4xl:col-span-2` }, (p) => (
                <ServicesCard
                  {...p}
                  services={data.services}
                  rows={rows}
                  search={typeof values.q === "string" ? values.q : ""}
                  loading={refreshing}
                  onClearFilters={clearServiceFilters}
                  exportJob={exportJob.job}
                  onExport={exportJob.start}
                  onCancelExport={exportJob.cancel}
                />
              ))}
              <Grid columns={{ base: 1, "@2xl": 2 }} className="items-start">
                {guard("Error budget remaining", { id: "dash-slos", className: SCROLL_MARGIN }, (p) => <BudgetCard {...p} />)}
                {guard("Recent deploys", { id: "dash-deploys", className: SCROLL_MARGIN }, (p) => <DeploysCard {...p} />)}
              </Grid>
            </Grid>

            <Grid columns={{ base: 1, "@4xl": 3 }} className="items-start">
              {guard("Slowest endpoints", { className: "@4xl:col-span-2" }, (p) => <EndpointsCard data={data} {...p} />)}
              {guard("5xx errors by hour", {}, (p) => <HeatmapCard data={data} {...p} />)}
            </Grid>
          </Stack>
        </AppShell.Main>

        <AppShell.BottomNav label="Kestrel Cloud">{BOTTOM.map(navItem)}</AppShell.BottomNav>
      </AppShell>
    </DashboardFrame>
  );
}
