import { BellOff, BookOpen, Copy, FileDown, MoreHorizontal, RotateCcw, SearchX } from "lucide-react";
import { type MouseEvent, type RefObject, useLayoutEffect, useRef, useState } from "react";

import { type DataTableColumn, DataTable, DescriptionList, EmptyState, Meter, type RowKey } from "../../../src/components/data";
import { ProgressBar } from "../../../src/components/feedback";
import { Inline, Stack } from "../../../src/components/layout";
import { ContextMenu, DropdownMenu, HoverCard, useToast } from "../../../src/components/overlays";
import { Button, Card, IconButton, Link, StatusLabel } from "../../../src/components/primitives";
import { formatNumber, formatPercent } from "../../../src/util/format";
import { DEPLOYS, INCIDENTS, type Service, type ServiceStatus, servicesOwnedBy, SLOS, STATUS, TEAMS } from "./data";
import { ago } from "./format";
import { DeployState, type Placement } from "./SideCards";
import type { ExportJob } from "./use-export-job";

/** A team's on-call and channel, previewed from its name. The link is the way in on touch: the card only previews it. */
function TeamLink({ team }: { team: string }) {
  const { toast } = useToast();
  const info = TEAMS[team];
  if (!info) return team;
  const notHere = (event: MouseEvent) => {
    event.preventDefault();
    toast({ title: "Team pages are not part of this specimen", description: team });
  };
  return (
    <HoverCard>
      <HoverCard.Trigger>
        <Link href={`#team-${team.toLowerCase()}`} onClick={notHere}>
          {team}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Content data-dashboard-team={team}>
        <Stack gap="r4">
          <p className="font-semibold">{team}</p>
          <DescriptionList>
            <DescriptionList.Item term="On call">{info.onCall}</DescriptionList.Item>
            <DescriptionList.Item term="Channel">
              <span className="font-mono">{info.channel}</span>
            </DescriptionList.Item>
            <DescriptionList.Item term="Services">{servicesOwnedBy(team).join(", ")}</DescriptionList.Item>
          </DescriptionList>
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => toast({ title: `Paged ${info.onCall}`, description: `${team} on-call`, tone: "info" })}
          >
            Page on-call
          </Button>
        </Stack>
      </HoverCard.Content>
    </HoverCard>
  );
}

const COLUMNS: DataTableColumn<Service>[] = [
  {
    id: "name",
    header: "Service",
    required: true,
    // The row's name keeps a short column's width; the selection, expand and actions
    // columns leave a card-wide table room for less, so Errors and CPU (priority 5)
    // step out first, and the name never truncates.
    width: "var(--COLUMN-SM)",
    value: (s) => s.name,
    cell: (s) => (
      <span className="font-medium" data-service={s.name}>
        {s.name}
      </span>
    ),
  },
  { id: "owner", header: "Team", priority: 3, value: (s) => s.owner, cell: (s) => <TeamLink team={s.owner} /> },
  {
    id: "status",
    header: "Status",
    truncate: false,
    value: (s) => STATUS[s.status].rank,
    firstDirection: "desc",
    cell: (s) => <StatusLabel tone={STATUS[s.status].tone}>{STATUS[s.status].label}</StatusLabel>,
  },
  { id: "rps", header: "Req/s", numeric: true, priority: 3, value: (s) => s.rps },
  { id: "p95", header: "p95 ms", numeric: true, priority: 2, value: (s) => s.p95 },
  {
    id: "errors",
    header: "Errors",
    numeric: true,
    priority: 5,
    value: (s) => s.errors,
    cell: (s) => formatPercent(s.errors, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    id: "cpu",
    header: "CPU",
    truncate: false,
    priority: 5,
    value: (s) => s.cpu,
    firstDirection: "desc",
    cell: (s) => (
      <Meter
        variant="inline"
        label={`${s.name} CPU`}
        value={s.cpu}
        thresholds={[
          { at: 80, tone: "warning" },
          { at: 90, tone: "error" },
        ]}
      />
    ),
  },
  {
    id: "deploy",
    header: "Last deploy",
    numeric: true,
    priority: 5,
    value: (s) => s.deployedMin,
    firstDirection: "asc",
    cell: (s) => ago(s.deployedMin),
  },
];

/** The deploy age starts hidden (a row's detail has the deploy); the columns menu brings it back. */
const DEFAULT_COLUMNS: ReadonlySet<string> = new Set(COLUMNS.map((c) => c.id).filter((id) => id !== "deploy"));

/** A row's detail: its deploy (with a rollout's progress), its open incident, its error budget, who has it. */
function ServiceDetail({ service }: { service: Service }) {
  const deploy = DEPLOYS.find((d) => d.service === service.name);
  const incident = INCIDENTS.find((i) => i.service === service.name);
  const slo = SLOS.find((x) => x.service === service.name);
  const team = TEAMS[service.owner];
  const rollout = deploy?.status === "progress" ? deploy.rollout : undefined;
  return (
    <Stack gap="r4" className="max-w-measure" data-dashboard-detail={service.name}>
      {deploy && rollout && (
        <ProgressBar
          variant="segmented"
          value={rollout.stage}
          max={rollout.stages}
          label={
            <>
              Rollout of <span className="font-mono">{deploy.version}</span>
            </>
          }
          valueText={`Stage ${formatNumber(rollout.stage)} of ${formatNumber(rollout.stages)} · ${formatNumber(rollout.hosts)} of ${formatNumber(rollout.of)} hosts`}
        />
      )}
      <DescriptionList>
        <DescriptionList.Item term="Owner">
          {service.owner}
          {team && ` · on call: ${team.onCall}`}
        </DescriptionList.Item>
        <DescriptionList.Item term="Last deploy">
          {deploy ? (
            <Inline as="span" gap="r5" rowGap="r6">
              <span>
                <span className="font-mono">{deploy.version}</span> by {deploy.author}, {ago(deploy.ageMin)}
              </span>
              <DeployState deploy={deploy} />
            </Inline>
          ) : (
            ago(service.deployedMin)
          )}
        </DescriptionList.Item>
        <DescriptionList.Item term="Open incident">
          {incident ? (
            <Inline as="span" gap="r5" rowGap="r6">
              <StatusLabel tone={STATUS[incident.status].tone}>{STATUS[incident.status].label}</StatusLabel>
              <span>
                {incident.title}, opened {ago(incident.ageMin)}
              </span>
            </Inline>
          ) : (
            "None"
          )}
        </DescriptionList.Item>
        {slo && (
          <DescriptionList.Item term="Error budget">
            {formatPercent(slo.left / 100, { maximumFractionDigits: 0 })} left of a{" "}
            {formatPercent(slo.target, { maximumFractionDigits: 2 })} objective
          </DescriptionList.Item>
        )}
      </DescriptionList>
    </Stack>
  );
}

const COUNT_ORDER: ServiceStatus[] = ["good", "warning", "serious", "critical", "stale"];

/**
 * One set of row actions, behind two doors: the row's actions button (the
 * keyboard's and the touch reader's way in) and a right-click, Shift+F10 or
 * long press anywhere on the row. Both menus share their item parts.
 */
function ServiceActions({ service }: { service: string }) {
  const { toast } = useToast();
  const say = (title: string) => () => toast({ title, description: service });
  return (
    <>
      <ContextMenu.Label className="max-w-[calc(var(--ROW-H)*6)] truncate">{service}</ContextMenu.Label>
      <ContextMenu.Item icon={<BookOpen />} onSelect={say("Opened the runbook")}>
        Open runbook
      </ContextMenu.Item>
      <ContextMenu.Item icon={<Copy />} onSelect={say("Copied the service name")}>
        Copy name
      </ContextMenu.Item>
      <ContextMenu.Item icon={<BellOff />} onSelect={say("Alerts silenced for an hour")}>
        Silence alerts for 1h
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item icon={<RotateCcw />} variant="danger" onSelect={say("Restart requested")}>
        Restart service
      </ContextMenu.Item>
    </>
  );
}

function RowMenu({ service }: { service: string }) {
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenu.Trigger asChild>
        <IconButton label={`Actions for ${service}`} icon={<MoreHorizontal />} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <ServiceActions service={service} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

const services = (n: number) => (n === 1 ? "1 service" : `${formatNumber(n)} services`);

export interface ServicesCardProps extends Placement {
  /** Every service: the header counts them. */
  services: Service[];
  /** The services the filters leave. */
  rows: Service[];
  /** The applied search, which the empty state names. */
  search: string;
  /** The data is being fetched again. */
  loading: boolean;
  /** Removes the filters only this table reads. */
  onClearFilters: () => void;
  /** An export under way, and the way to start or cancel one. */
  exportJob: ExportJob | null;
  onExport: (count: number) => void;
  onCancelExport: () => void;
}

/**
 * Whether the card is at least two `--COLUMN-SM` wide. Narrower (a phone beside
 * the shell's rail), the pinned name, checkbox and expander would cover most of
 * the table and the columns scrolled under them, row actions included.
 */
function usePinRoom(card: RefObject<HTMLElement | null>): boolean {
  const [room, setRoom] = useState(true);
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) return;
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText = "position:absolute;visibility:hidden;block-size:0;inline-size:calc(2 * var(--COLUMN-SM))";
    element.append(probe);
    const measure = () => setRoom(element.getBoundingClientRect().width >= probe.getBoundingClientRect().width);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      probe.remove();
    };
  }, [card]);
  return room;
}

/**
 * Every service, worst first, ten to a page. Columns drop by the TABLE's
 * width (priority) and the columns menu chooses among them; headers resize; the
 * service name stays pinned while the table scrolls sideways, when the card has
 * room for it (`usePinRoom`). A row opens to
 * its deploy, incident and error budget; selected rows take bulk actions. The
 * filters live in the page's FilterBar; filtering to nothing shows a designed
 * empty state with the way out. An export in progress shows its progress here.
 */
export function ServicesCard({
  services: all,
  rows,
  search,
  loading,
  onClearFilters,
  exportJob,
  onExport,
  onCancelExport,
  id,
  className,
}: ServicesCardProps) {
  const { toast } = useToast();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const pin = usePinRoom(card);
  const counts = COUNT_ORDER.map((status) => ({ status, n: all.filter((s) => s.status === status).length })).filter((c) => c.n > 0);
  const needle = search.trim();
  const bulk = (title: string, keys: ReadonlySet<RowKey>, tone?: "warning") => () =>
    toast({ title, description: [...keys].join(", "), tone });

  return (
    <Card ref={card} id={id} className={className} data-dashboard-services="">
      <Card.Header>
        <Card.Title as="h2">Services</Card.Title>
        <Card.Description>
          <Inline as="span" gap="r3" rowGap="r6">
            {counts.map(({ status, n }) => (
              <StatusLabel key={status} tone={STATUS[status].tone} className="text-body-3">
                {formatNumber(n)} {STATUS[status].label.toLowerCase()}
              </StatusLabel>
            ))}
          </Inline>
        </Card.Description>
      </Card.Header>
      {exportJob && (
        <Card.Body>
          <Inline gap="r3" wrap={false} align="end" data-dashboard-export="">
            <ProgressBar
              className="flex-1"
              label={`Exporting ${services(exportJob.total)} to CSV`}
              value={exportJob.done}
              max={exportJob.total}
              valueText={`${formatNumber(exportJob.done)} of ${formatNumber(exportJob.total)}`}
            />
            <Button variant="ghost" onClick={onCancelExport}>
              Cancel export
            </Button>
          </Inline>
        </Card.Body>
      )}
      <ContextMenu>
        <ContextMenu.Trigger
          asChild
          // The row under the pointer, or holding focus (its actions button), decides
          // what the menu acts on; the header, detail rows and the empty state keep the browser's menu.
          onBeforeOpen={(target) => {
            const service = target.closest("tbody tr")?.querySelector<HTMLElement>("[data-service]")?.dataset.service;
            if (!service) return false;
            setMenuFor(service);
          }}
        >
          <div className="min-w-0">
            <DataTable
              aria-label="Services"
              variant="rules"
              columns={COLUMNS}
              rows={rows}
              getRowKey={(s) => s.name}
              getRowLabel={(s) => `Select ${s.name}`}
              defaultSort={{ column: "status", direction: "desc" }}
              loading={loading}
              rowActions={(s) => <RowMenu service={s.name} />}
              renderDetail={(s) => <ServiceDetail service={s} />}
              columnsMenu
              defaultVisibleColumns={DEFAULT_COLUMNS}
              resizableColumns
              stickyColumns={pin ? 1 : 0}
              selectable
              bulkActions={(keys) => (
                <>
                  <Button variant="secondary" iconStart={<FileDown />} onClick={() => onExport(keys.size)}>
                    Export
                  </Button>
                  <Button variant="ghost" iconStart={<BellOff />} onClick={bulk("Alerts silenced for an hour", keys)}>
                    Silence alerts
                  </Button>
                  <Button variant="danger" iconStart={<RotateCcw />} onClick={bulk("Restart requested", keys, "warning")}>
                    Restart
                  </Button>
                </>
              )}
              defaultPageSize={10}
              pageSizeOptions={[5, 10, 25]}
              empty={
                <EmptyState
                  icon={<SearchX />}
                  title={needle ? `No services match “${needle}”` : "No services match these filters"}
                  description={
                    needle
                      ? "Search looks at service names and owning teams; status and latency filters apply too."
                      : "Status and latency filters narrow this table; time and region still apply."
                  }
                  actions={
                    <Button variant="secondary" onClick={onClearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              }
            />
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Content aria-label={menuFor ? `Actions for ${menuFor}` : "Service actions"} data-dashboard-row-menu="">
          {menuFor && <ServiceActions service={menuFor} />}
        </ContextMenu.Content>
      </ContextMenu>
    </Card>
  );
}
