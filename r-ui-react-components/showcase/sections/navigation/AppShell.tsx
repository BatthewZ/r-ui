import {
  Activity,
  LayoutGrid,
  Plus,
  Rocket,
  ScrollText,
  Server,
  Settings,
  Target,
  TriangleAlert,
  Waypoints,
} from "lucide-react";
import { type CSSProperties, type MouseEvent, useState } from "react";

import { Grid, Stack } from "../../../src/components/layout";
import { AppShell } from "../../../src/components/navigation";
import { Button } from "../../../src/components/primitives";
import { formatNumber } from "../../../src/util/format";
import { Row } from "./parts/demo";

export const meta = {
  title: "AppShell",
  group: "navigation",
  order: 10,
  description:
    "The viewport picks the form: full sidebar on wide screens, icon rail on medium, bottom nav on phones (resize the window, not the demo). Labels stay the rail's accessible names and show on hover or focus. Collapse is controlled here; Tab once inside a frame for the skip link.",
};

const NAV = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "services", label: "Services", Icon: Server },
  { id: "incidents", label: "Incidents", Icon: TriangleAlert, badge: 4 },
  { id: "deploys", label: "Deploys", Icon: Rocket },
  { id: "slos", label: "Service-level objectives", Icon: Target },
  { id: "logs", label: "Logs", Icon: ScrollText },
  { id: "traces", label: "Traces", Icon: Waypoints },
] as const;

const BOTTOM = ["overview", "services", "incidents", "deploys", "settings"];

// The shell normally fills the window; in a demo it fills a scrolling frame.
const frame = {
  blockSize: "calc(var(--CONTROL-H) * 14)",
  "--r-navigation-shell-viewport": "calc(var(--CONTROL-H) * 14)",
} as CSSProperties;

function DemoShell({ withBottomNav = true }: { withBottomNav?: boolean }) {
  const [current, setCurrent] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const go = (id: string) => (event: MouseEvent) => {
    event.preventDefault();
    setCurrent(id);
  };
  const all = [...NAV, { id: "settings", label: "Settings", Icon: Settings }];
  const title = all.find((n) => n.id === current)?.label ?? "";

  return (
    <AppShell collapsed={collapsed} onCollapsedChange={setCollapsed}>
      <AppShell.Sidebar>
        <AppShell.Brand href="#" onClick={go("overview")} mark={<Activity aria-hidden />}>
          Kestrel Cloud
        </AppShell.Brand>
        <AppShell.SidebarSection title="Monitor">
          {NAV.slice(0, 5).map(({ id, label, Icon, ...rest }) => (
            <AppShell.NavItem
              key={id}
              href={`#${id}`}
              onClick={go(id)}
              current={current === id}
              icon={<Icon aria-hidden />}
              badge={"badge" in rest ? formatNumber(rest.badge) : undefined}
            >
              {label}
            </AppShell.NavItem>
          ))}
        </AppShell.SidebarSection>
        <AppShell.SidebarSection title="Explore">
          {NAV.slice(5).map(({ id, label, Icon }) => (
            <AppShell.NavItem key={id} href={`#${id}`} onClick={go(id)} current={current === id} icon={<Icon aria-hidden />}>
              {label}
            </AppShell.NavItem>
          ))}
        </AppShell.SidebarSection>
        <AppShell.SidebarSection position="end">
          <AppShell.NavItem
            href="#settings"
            onClick={go("settings")}
            current={current === "settings"}
            icon={<Settings aria-hidden />}
          >
            Settings
          </AppShell.NavItem>
        </AppShell.SidebarSection>
        <AppShell.SidebarToggle />
      </AppShell.Sidebar>

      <AppShell.Header>
        <h2 className="min-w-0 flex-1 truncate text-h3">{title}</h2>
        <Button variant="primary" iconStart={<Plus />}>
          New deploy
        </Button>
      </AppShell.Header>

      <AppShell.Main>
        <Stack gap="r2">
          <p className="max-w-measure text-fg-secondary">
            Scroll this frame: the header sticks to the top, the sidebar stays put, and on a phone the bottom
            nav stays pinned without covering the last card.
          </p>
          <Grid minColumn="sm">
            {["Requests", "Error rate", "p95 latency", "Saturation", "Open incidents", "Deploys today"].map(
              (name, i) => (
                <div key={name} className="grid gap-r5 rounded-lg border bg-surface-0 p-r2">
                  <span className="text-body-2 text-fg-secondary">{name}</span>
                  <span className="text-h2 font-semibold">{formatNumber((i + 1) * 1234.5)}</span>
                </div>
              ),
            )}
          </Grid>
          <div className="grid gap-r5 rounded-lg border bg-surface-0 p-r2">
            <h2 className="text-h4">Last card</h2>
            <p className="text-fg-secondary">The bottom nav must never hide this line.</p>
          </div>
        </Stack>
      </AppShell.Main>

      {withBottomNav && (
        <AppShell.BottomNav>
          {BOTTOM.map((id) => {
            const item = all.find((n) => n.id === id)!;
            const { Icon } = item;
            return (
              <AppShell.NavItem
                key={id}
                href={`#${id}`}
                onClick={go(id)}
                current={current === id}
                icon={<Icon aria-hidden />}
                badge={"badge" in item ? formatNumber(item.badge) : undefined}
              >
                {item.label}
              </AppShell.NavItem>
            );
          })}
        </AppShell.BottomNav>
      )}
    </AppShell>
  );
}

export default function AppShellSection() {
  return (
    <Stack gap="r2">
      <Row label="Default · resize the window across the lg and md breakpoints">
        <div className="overflow-auto rounded-md border" style={frame} data-testid="shell-frame">
          <DemoShell />
        </div>
      </Row>
      <Row label="Right-to-left, compact, no BottomNav (phones keep the rail)">
        <div dir="rtl" data-density="compact" className="overflow-auto rounded-md border" style={frame}>
          <DemoShell withBottomNav={false} />
        </div>
      </Row>
    </Stack>
  );
}
