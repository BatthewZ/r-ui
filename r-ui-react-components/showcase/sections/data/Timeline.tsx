import { GitCommitHorizontal, Rocket, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { ActivityFeed, type ActivityItem, Button, Timeline, type TimelineEvent } from "../../../src";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "Timeline",
  group: "data",
  order: 75,
  components: ["ActivityFeed"],
  description:
    "Events in time: an ordered list per local day under sticky day headers, a connector and a mark per event (tone = glyph + word + disc, never colour alone), relative or absolute `<time datetime>` with the full reading on hover and keyboard focus. Clamped descriptions, paging, empty and loading states; ActivityFeed is its actor-verb-object preset.",
};

/** A fixed "now" so every load (and screenshot) reads the same. */
const NOW = new Date(2026, 9, 15, 14, 30);
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const ahead = (min: number) => ago(-min);
const HOUR = 60;
const DAY = 24 * HOUR;

const INCIDENTS: TimelineEvent[] = [
  {
    id: "i1",
    time: ago(14),
    tone: "error",
    statusLabel: "Critical",
    title: "Elevated 5xx on checkout",
    actor: "Mia Rossi",
    meta: "checkout · eu-west",
    actions: (
      <>
        <Button variant="secondary">Acknowledge</Button>
        <Button variant="ghost">Open runbook</Button>
      </>
    ),
  },
  {
    id: "i2",
    time: ago(52),
    tone: "serious",
    statusLabel: "Degraded",
    title: "p95 regression in search after deploy 4f2a91c",
    actor: "Jon Tate",
    meta: "search · all regions",
  },
  { id: "i3", time: ago(3 * HOUR + 10), tone: "warning", title: "Disk at 85% on ledger-db-2", actor: "Ama Kofi", meta: "ledger · us-east" },
  {
    id: "i4",
    time: ago(DAY + 2 * HOUR),
    tone: "success",
    statusLabel: "Resolved",
    title: "Webhook retries backing up",
    actor: "Sam Park",
    meta: "webhooks · global",
  },
  { id: "i5", time: ago(2 * DAY + 5 * HOUR), tone: "stale", statusLabel: "No data", title: "feature-flags stopped reporting", meta: "feature-flags" },
];

const SERVICES = ["search", "billing", "checkout", "api-gateway", "media-transcoder", "webhooks", "auth", "ledger"];
const AUTHORS = ["Jon Tate", "Mia Rossi", "Raf Duarte", "Devon Ilunga", "Kim Lee", "Sam Park"];

/** Twenty-four deploys over five days, every few hours: enough to scroll past several day headers. */
const DEPLOYS: TimelineEvent[] = Array.from({ length: 24 }, (_, i) => {
  const rolledBack = i === 4 || i === 15;
  const service = SERVICES[i % SERVICES.length] ?? "api";
  return {
    id: `d${i}`,
    time: ago(6 + i * 5 * HOUR + (i % 3) * 37),
    tone: i === 0 ? "info" : rolledBack ? "error" : "success",
    statusLabel: i === 0 ? "Rolling out" : rolledBack ? "Rolled back" : "Live",
    icon: i === 0 ? <Rocket /> : rolledBack ? <Undo2 /> : undefined,
    title: (
      <>
        {service} <span className="font-mono font-normal text-fg-muted">v{2 + (i % 7)}.{(i * 3) % 20}.{i % 4}</span>
      </>
    ),
    actor: AUTHORS[i % AUTHORS.length],
  };
});

const LONG =
  "Rotated the signing key for the payments webhook endpoint after the quarterly review flagged it as older than ninety days. The old key stays valid for verification for 24 hours so in-flight retries still pass, then it is revoked. Consumers that pinned the key fingerprint instead of fetching the JWKS document will start failing at that point; the three known ones were notified in #payments-integrations and two have already moved. Rollback: re-enable the previous key in the vault and redeploy the edge config.";

const AUDIT: TimelineEvent[] = [
  {
    id: "a0",
    time: ahead(2 * DAY + 3 * HOUR),
    tone: "info",
    statusLabel: "Scheduled",
    title: "Maintenance window: ledger-db failover drill",
    actor: "Ama Kofi",
    meta: "ledger-db · us-east",
  },
  { id: "a1", time: ago(35), tone: "warning", statusLabel: "Key rotated", title: "Signing key rotated: payments webhooks", actor: "Devon Ilunga-Okonkwo-Vasquez", description: LONG },
  { id: "a2", time: ago(4 * HOUR), title: "Role changed: viewer → admin for contractor-integrations@vendor.example.com", description: "Granted by policy auto-escalation (no human actor)." },
  { id: "a3", time: ago(26 * HOUR), title: "Exported 12,480 audit records to CSV", actor: { name: "Kim Lee" } },
  { id: "a4", time: "2026-10-12", title: "Retention policy reviewed (calendar date, no time of day)", actor: "Sam Park" },
  { id: "a5", time: "not-a-timestamp", title: "Imported legacy entry with a malformed timestamp" },
];

const ACTIVITY: ActivityItem[] = [
  { id: "f1", time: ago(3), actor: "Mia Rossi", verb: "merged", object: "PR 482 Retry budget for checkout", tone: "success", statusLabel: "Merged" },
  { id: "f2", time: ago(40), actor: { name: "Jon Tate" }, verb: "commented on", object: "INC-2291", meta: "“Rolling back the search deploy now.”" },
  { id: "f3", time: ago(5 * HOUR), actor: "Raf Duarte", verb: "rolled back", object: "checkout v5.3.1", tone: "error", statusLabel: "Rolled back", icon: <Undo2 /> },
];

/** Every pairing of mark kinds in one list: icon → dot, dot → dot, dot → icon, icon → icon. */
const THREADS: TimelineEvent[] = [
  { id: "t1", time: ago(5), tone: "info", statusLabel: "Started", title: "Migration started", icon: <Rocket /> },
  { id: "t2", time: ago(20), title: "Copied 1.2M rows to the new table" },
  { id: "t3", time: ago(35), title: "Backfilled the index" },
  { id: "t4", time: ago(50), tone: "warning", statusLabel: "Paused", title: "Paused for the nightly backup" },
  { id: "t5", time: ago(65), tone: "success", statusLabel: "Verified", title: "Row counts match" },
  { id: "t6", time: ago(80), title: "Switched reads to the new table" },
];

const RTL: TimelineEvent[] = [
  { id: "r1", time: ago(9), tone: "error", statusLabel: "تعطل", title: "ارتفاع أخطاء 5xx في خدمة الدفع", actor: "مريم", meta: "checkout · eu-west" },
  { id: "r2", time: ago(2 * HOUR), tone: "success", statusLabel: "تم الحل", title: "تمت إعادة تشغيل خادم البحث", actor: "يوسف" },
  { id: "r3", time: ago(DAY + HOUR), title: "تمت إضافة ملاحظة إلى الحادث" },
];

export default function TimelineSection() {
  return (
    <div className="grid grid-cols-1 gap-r1 @3xl:grid-cols-2">
      <Demo title="Incidents (comfortable, relative times)">
        <Timeline events={INCIDENTS} now={NOW} data-sc="timeline-incidents" />
      </Demo>
      <Demo title="Incidents (compact)">
        <div data-density="compact">
          <Timeline events={INCIDENTS} now={NOW} data-sc="timeline-compact" />
        </div>
      </Demo>
      <Demo title="Deploy history (its own scroller, absolute times, sticky day headers)">
        <Timeline
          events={DEPLOYS}
          now={NOW}
          timeFormat="absolute"
          scrollable
          label="Deploy history"
          className="max-h-[calc(var(--ROW-H)*9)] rounded-md border border-border px-r3 pb-r3"
          data-sc="timeline-deploys"
        />
      </Demo>
      <Demo title="Audit log (long text, missing actor, future-dated, calendar date, bad timestamp)">
        <Timeline events={AUDIT} now={NOW} groupByDay={false} label="Audit log" timeFormat="absolute" data-sc="timeline-audit" />
      </Demo>
      <Demo title="Activity feed (preset: actor, verb, object)">
        <ActivityFeed items={ACTIVITY} now={NOW} />
      </Demo>
      <Demo title="Paged: three at a time, then loaded on demand">
        <Paged />
      </Demo>
      <Demo title="Threads: every pairing of icon and dot marks">
        <Timeline events={THREADS} now={NOW} groupByDay={false} label="Migration" data-sc="timeline-threads" />
      </Demo>
      <Demo title="Right to left">
        <div dir="rtl" lang="ar" data-sc="timeline-rtl">
          <Timeline events={RTL} now={NOW} locale="ar" />
        </div>
      </Demo>
      <Demo title="One event, none, loading">
        <div className="grid gap-r3">
          <Timeline events={INCIDENTS.slice(0, 1)} now={NOW} groupByDay={false} label="One incident" data-sc="timeline-one" />
          <Timeline events={[]} now={NOW} data-sc="timeline-empty" />
          <Timeline events={[]} now={NOW} loading data-sc="timeline-loading" />
        </div>
      </Demo>
    </div>
  );
}

/** Local pages first, then a fake fetch that appends older deploys, twice. */
function Paged() {
  const [events, setEvents] = useState(() => DEPLOYS.slice(0, 6));
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    setTimeout(() => {
      setEvents((list) => [
        ...list,
        ...DEPLOYS.slice(list.length, list.length + 3).map((e) => ({ ...e, icon: <GitCommitHorizontal /> })),
      ]);
      setLoading(false);
    }, 600);
  };
  return (
    <Timeline
      events={events}
      now={NOW}
      pageSize={3}
      hasMore={events.length < 12}
      onLoadMore={load}
      loadingMore={loading}
      label="Paged deploys"
      data-sc="timeline-paged"
    />
  );
}

function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-r4">
      <DemoLabel>{title}</DemoLabel>
      {children}
    </div>
  );
}
