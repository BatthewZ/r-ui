import { Check, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Avatar, Badge, Button, IconButton, Kanban, type KanbanColumn, type KanbanMove, type KanbanProps, type Tone } from "../../../../src";

/** An incident on the board. In a subfolder, which the section registry does not glob. */
export interface Incident {
  id: string;
  columnId: string;
  key: string;
  title: string;
  severity: 1 | 2 | 3 | 4;
  service: string;
  assignee?: string;
}

const SEVERITY_TONE: Record<Incident["severity"], Tone> = { 1: "error", 2: "serious", 3: "warning", 4: "neutral" };

export const INCIDENT_COLUMNS: KanbanColumn[] = [
  { id: "triage", title: "Triage", limit: 6 },
  { id: "progress", title: "In progress", limit: 3 },
  { id: "review", title: "Review", limit: 2 },
  { id: "done", title: "Done" },
];

const incident = (n: number, columnId: string, title: string, severity: Incident["severity"], service: string, assignee?: string): Incident => ({
  id: `inc-${n}`,
  columnId,
  key: `INC-${2000 + n}`,
  title,
  severity,
  service,
  assignee,
});

export const INCIDENTS: Incident[] = [
  incident(41, "triage", "Elevated 5xx on checkout", 1, "checkout", "Mia Rossi"),
  incident(42, "triage", "Search latency p95 above 800 ms", 2, "search"),
  incident(43, "triage", "Stale exchange rates in the EU region", 3, "payments", "Kenji Sato"),
  incident(44, "triage", "Certificate renewal failed on the status page", 3, "status"),
  incident(45, "triage", "Password reset email delayed", 4, "identity"),
  incident(46, "triage", "Dashboard tiles flicker on reconnect", 4, "web"),
  incident(47, "triage", "Unbroken log line: ERR_CONNECTION_RESET_BY_PEER_AFTER_TLS_HANDSHAKE_TIMEOUT_ON_UPSTREAM", 4, "edge"),
  incident(31, "progress", "Payment webhooks retried twice", 2, "payments", "Ana Lima"),
  incident(32, "progress", "Queue backlog on order export", 3, "orders", "Sam Okafor"),
  incident(33, "progress", "Disk at 91% on the analytics replica", 3, "analytics", "Lee Park"),
  incident(21, "review", "Rate limiter misconfigured for partners", 2, "gateway", "Mia Rossi"),
  incident(22, "review", "Broken avatar uploads on Safari", 4, "web", "Kenji Sato"),
  incident(23, "review", "Timeout on bulk invoice download", 3, "billing", "Ana Lima"),
  incident(11, "done", "DNS failover drill", 4, "infra", "Lee Park"),
];

/** A card's content: the title, a severity badge, an acknowledge toggle, the key, service and assignee. */
export function IncidentCard({ item, words = { acknowledge: "Acknowledge", severity: "Sev" } }: { item: Incident; words?: { acknowledge: string; severity: string } }) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <div className="grid gap-r5">
      <div className="flex items-start gap-r5">
        <span className="min-w-0 flex-1 font-medium">{item.title}</span>
        <IconButton
          label={`${words.acknowledge} ${item.key}`}
          icon={<Check />}
          aria-pressed={acknowledged}
          onClick={() => setAcknowledged((v) => !v)}
          data-sc="kanban-ack"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-r4 gap-y-r6 text-body-3 text-fg-secondary">
        <Badge tone={SEVERITY_TONE[item.severity]}>
          {words.severity} {item.severity}
        </Badge>
        <span className="font-mono">{item.key}</span>
        <span>{item.service}</span>
        {item.assignee && <Avatar name={item.assignee} size="icon" className="ms-auto" />}
      </div>
    </div>
  );
}

/** A board as a page writes one: it owns the value, applies each move, and counts them for the checks. */
export function IncidentBoard({
  initial = INCIDENTS,
  columns = INCIDENT_COLUMNS,
  addLabel = "Add incident",
  words,
  footer = true,
  ...props
}: Omit<KanbanProps<Incident>, "value" | "onValueChange" | "renderCard" | "columns" | "aria-label" | "aria-labelledby"> & {
  "aria-label": string;
  initial?: Incident[];
  columns?: KanbanColumn[];
  addLabel?: string;
  words?: { acknowledge: string; severity: string };
  /** Under the board: how many moves the value took, and the last one. */
  footer?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [moves, setMoves] = useState<KanbanMove[]>([]);
  const [added, setAdded] = useState(0);
  const add = (column: string) => {
    const n = added + 1;
    setAdded(n);
    setValue((all) => [...all, incident(90 + n, column, `New incident ${n}`, 4, "unassigned")]);
  };
  return (
    <div className="grid min-w-0 gap-r4">
      <Kanban<Incident>
        columns={columns}
        value={value}
        onValueChange={(next, move) => {
          setValue(next);
          setMoves((all) => [...all, move]);
        }}
        renderCard={(item) => <IncidentCard item={item} words={words} />}
        cardLabel={(item) => `${item.key} ${item.title}`}
        renderAddCard={(column) => (
          <Button variant="ghost" iconStart={<Plus />} className="w-full justify-start" onClick={() => add(column.id)}>
            {addLabel}
          </Button>
        )}
        data-sc-scrolls
        {...props}
      />
      {footer && <MoveLog moves={moves} />}
    </div>
  );
}

function MoveLog({ moves }: { moves: KanbanMove[] }): ReactNode {
  const last = moves.at(-1);
  return (
    <output className="text-body-2 text-fg-secondary" data-sc="kanban-moves" data-count={moves.length}>
      Moves: {moves.length}
      {last && ` · last: ${last.id} from ${last.from.column} #${last.from.index + 1} to ${last.to.column} #${last.to.index + 1}`}
    </output>
  );
}
