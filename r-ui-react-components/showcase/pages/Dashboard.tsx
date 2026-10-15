import {
  Activity,
  BellOff,
  Copy,
  FileDown,
  FlaskConical,
  LayoutGrid,
  Megaphone,
  MoreHorizontal,
  RefreshCw,
  Rocket,
  ScrollText,
  Server,
  Settings,
  Target,
  TriangleAlert,
  Waypoints,
} from "lucide-react";
import { type MouseEvent, type ReactNode, useMemo, useState } from "react";

import { SearchInput, SegmentedControl, Select } from "../../src/components/form";
import { Grid, Inline, Stack } from "../../src/components/layout";
import { AppShell } from "../../src/components/navigation";
import { DropdownMenu, useToast } from "../../src/components/overlays";
import { Avatar, Badge, IconButton } from "../../src/components/primitives";
import { formatNumber } from "../../src/util/format";
import { href } from "../shell/router";
import { type Env, generate, INCIDENTS, RANGES, type Range, type Region, REGIONS } from "./dashboard/data";
import { ago } from "./dashboard/format";
import { DashboardFrame } from "./dashboard/Frame";
import { KpiRow } from "./dashboard/KpiRow";
import { type ServiceFilter, ServicesCard } from "./dashboard/ServicesCard";
import { BudgetCard, DeploysCard, EndpointsCard, HeatmapCard, IncidentsCard } from "./dashboard/SideCards";
import { TrafficCard } from "./dashboard/TrafficCard";

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

/**
 * The mockup's operations dashboard, rebuilt from library components only:
 * an AppShell (full sidebar / rail / bottom nav by viewport), filters that
 * regenerate seeded data, KPI tiles, traffic as a line chart and stacked error
 * columns, incidents, a services table that drops columns by its own width,
 * meters, a compact card, a 5xx heatmap, and toasts from the header's actions. See `dashboard/Frame.tsx` for why it
 * takes the whole window.
 */
export function Dashboard() {
  const { toast } = useToast();
  const [range, setRange] = useState<Range>("7d");
  const [region, setRegion] = useState<Region | "all">("all");
  const [env, setEnv] = useState<Env>("production");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ServiceFilter>("all");
  const [current, setCurrent] = useState<NavId>("overview");
  const data = useMemo(() => generate(range, region, env), [range, region, env]);

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

  const search = (className: string) => (
    <SearchInput
      aria-label="Search services"
      placeholder="Search services or teams"
      value={query}
      onValueChange={setQuery}
      className={className}
    />
  );

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
          <Inline gap="r4" wrap={false} className="min-w-0 flex-1">
            <h1 className="truncate text-h2">Platform overview</h1>
            <Badge className="shrink-0 max-md:hidden">{env}</Badge>
          </Inline>
          {search("w-column-md max-md:hidden")}
          <DropdownMenu placement="bottom-end">
            <DropdownMenu.Trigger asChild>
              <IconButton variant="ghost" label="Dashboard actions" icon={<MoreHorizontal />} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                icon={<RefreshCw />}
                onSelect={() => toast({ title: "Dashboard refreshed", description: "Every panel reloaded.", tone: "success" })}
              >
                Refresh now
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<Copy />}
                onSelect={() => toast({ title: "Link copied", description: `Opens this view: ${range}, ${region}, ${env}.` })}
              >
                Copy link to this view
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<FileDown />}
                onSelect={() =>
                  toast({
                    title: "Export started",
                    description: `${formatNumber(data.services.length)} services, ${range}. You will get an email.`,
                    tone: "info",
                  })
                }
              >
                Export services as CSV
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                icon={<BellOff />}
                onSelect={() =>
                  toast({
                    title: "Alerts muted for 1 hour",
                    description: "On-call will not be paged for this dashboard.",
                    tone: "warning",
                    action: { label: "Undo", onClick: () => toast({ title: "Alerts unmuted", tone: "success" }) },
                  })
                }
              >
                Mute alerts for 1 hour
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
          <Avatar name="Bea Marsh" alt="Signed in as Bea Marsh" className="shrink-0" />
        </AppShell.Header>

        {/* The showcase page already owns <main>; a second main landmark is invalid. */}
        <AppShell.Main as="div">
          <Stack gap="r3" id="dash-top" className={SCROLL_MARGIN}>
            <Inline as="section" aria-label="Filters" gap="r4" rowGap="r4">
              <SegmentedControl aria-label="Time range" value={range} onValueChange={(v) => setRange(v as Range)}>
                {RANGES.map((r) => (
                  <SegmentedControl.Item key={r} value={r}>
                    {r}
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl>
              <Inline gap="r4" wrap={false} className="max-md:w-full">
                <Select
                  aria-label="Region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region | "all")}
                  className="w-column-sm max-md:flex-1"
                >
                  <option value="all">All regions</option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="Environment"
                  value={env}
                  onChange={(e) => setEnv(e.target.value as Env)}
                  className="w-column-sm max-md:flex-1"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                </Select>
              </Inline>
              {search("md:hidden")}
              <span className="ms-auto text-body-3 text-fg-muted">Updated {ago(2)}</span>
            </Inline>

            <KpiRow data={data} range={range} />

            <Grid columns={{ base: 1, "@4xl": 3 }} className="items-start">
              <TrafficCard data={data} range={range} className="@4xl:col-span-2" />
              <IncidentsCard id="dash-incidents" className={SCROLL_MARGIN} />
            </Grid>

            <Grid columns={{ base: 1, "@4xl": 3 }} className="items-start">
              <ServicesCard
                id="dash-services"
                className={`${SCROLL_MARGIN} @4xl:col-span-2`}
                services={data.services}
                query={query}
                filter={filter}
                onFilterChange={setFilter}
                onClear={() => {
                  setQuery("");
                  setFilter("all");
                }}
              />
              <Grid columns={{ base: 1, "@2xl": 2 }} className="items-start">
                <BudgetCard id="dash-slos" className={SCROLL_MARGIN} />
                <DeploysCard id="dash-deploys" className={SCROLL_MARGIN} />
              </Grid>
            </Grid>

            <Grid columns={{ base: 1, "@4xl": 3 }} className="items-start">
              <EndpointsCard data={data} className="@4xl:col-span-2" />
              <HeatmapCard data={data} />
            </Grid>
          </Stack>
        </AppShell.Main>

        <AppShell.BottomNav label="Kestrel Cloud">{BOTTOM.map(navItem)}</AppShell.BottomNav>
      </AppShell>
    </DashboardFrame>
  );
}
