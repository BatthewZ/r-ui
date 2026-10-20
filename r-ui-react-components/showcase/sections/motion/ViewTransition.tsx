import { ArrowLeft, ArrowRight, LayoutGrid, List, PenLine, Rocket, SunMoon, Users } from "lucide-react";
import { type CSSProperties, type MouseEvent, useEffect, useRef, useState } from "react";

import { Sparkline } from "../../../src/components/data";
import { SegmentedControl } from "../../../src/components/form";
import { useViewTransition } from "../../../src/components/motion";
import { Button } from "../../../src/components/primitives";
import { useTheme } from "../../../src/hooks/use-preferences";
import { PREFERENCES, THEMES } from "../../shell/view";
import { Row, Stack } from "../overlays/parts/demo";
import { runTransition } from "./parts/run-transition";

export const meta = {
  title: "View transitions",
  group: "motion",
  order: 30,
  description:
    "useViewTransition() runs a React update inside document.startViewTransition, flushed so the new view is what the browser snapshots. Items with a view-transition-name morph to their new place. Below it, choreographies a dashboard, a marketing page and an app reach for, each styled in the showcase's CSS while its own transition runs. Without the API, or under reduced motion, every update simply applies.",
};

/** A name that only applies while `kind`'s transition runs (showcase.css), so demos never capture each other. */
const named = (name: string): CSSProperties => ({ "--sc-vt-name": name }) as CSSProperties;

const SERVICES = ["checkout-api", "payments-worker", "search-indexer", "notifications", "image-resizer", "auth-gateway"];

function LayoutSwitch() {
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const transition = useViewTransition();
  return (
    <div className="flex flex-col gap-r3">
      <SegmentedControl
        aria-label="Layout"
        value={layout}
        onValueChange={(next) => void transition(() => setLayout(next === "grid" ? "grid" : "list"))}
        className="self-start"
      >
        <SegmentedControl.Item value="list" icon={<List />}>
          List
        </SegmentedControl.Item>
        <SegmentedControl.Item value="grid" icon={<LayoutGrid />}>
          Grid
        </SegmentedControl.Item>
      </SegmentedControl>
      <ul
        className={
          layout === "grid"
            ? "grid gap-r4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--COLUMN-SM)),1fr))]"
            : "flex max-w-measure flex-col gap-r5"
        }
      >
        {SERVICES.map((name) => (
          <li
            key={name}
            style={{ viewTransitionName: `sc-vt-${name}` } as CSSProperties}
            className="sc-vt-layout-item rounded-md border border-border bg-surface-0 px-r3 py-r4 font-mono text-body-1"
          >
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

const KPIS = [
  {
    id: "latency",
    label: "p95 latency",
    value: "212",
    unit: "ms",
    series: [180, 190, 176, 205, 230, 260, 240, 221, 212, 208, 215, 212],
    note: "Up 38ms on yesterday: the payments worker's queue grew through the lunchtime peak.",
  },
  {
    id: "errors",
    label: "Error rate",
    value: "0.42",
    unit: "%",
    series: [0.3, 0.32, 0.35, 0.31, 0.4, 0.52, 0.48, 0.44, 0.42, 0.41, 0.43, 0.42],
    note: "Within budget. Most errors are retried card declines, not failures of ours.",
  },
  {
    id: "throughput",
    label: "Requests",
    value: "18.4k",
    unit: "/s",
    series: [12, 13, 15, 17, 18, 19, 18.5, 18, 18.2, 18.6, 18.3, 18.4],
    note: "A normal Tuesday: the weekly peak lands on Thursday afternoon.",
  },
];

/** Dashboard: a KPI tile grows into its detail panel (one name on both), and shrinks back into place. */
function DrillDown() {
  const [open, setOpen] = useState<string | null>(null);
  const last = useRef<string | null>(null);
  const back = useRef<HTMLButtonElement>(null);
  const tiles = useRef<HTMLUListElement>(null);
  const kpi = KPIS.find((k) => k.id === open);

  // Focus follows the view: into the panel's Back, then home to the tile it came from.
  useEffect(() => {
    if (open) back.current?.focus();
    else if (last.current) tiles.current?.querySelector<HTMLButtonElement>(`[data-kpi="${last.current}"]`)?.focus();
  }, [open]);

  const go = (next: string | null) => {
    if (next) last.current = next;
    runTransition("drill", () => setOpen(next));
  };

  if (kpi) {
    return (
      <div
        data-sc="vt-kpi-detail"
        style={named(`sc-vt-kpi-${kpi.id}`)}
        className="sc-vt-kpi grid gap-r3 rounded-lg border border-border bg-surface-0 p-r2"
      >
        <div className="flex flex-wrap items-center justify-between gap-r3">
          <h4 className="text-h4 text-fg-primary">{kpi.label}</h4>
          <Button ref={back} variant="secondary" iconStart={<ArrowLeft />} onClick={() => go(null)}>
            Back to overview
          </Button>
        </div>
        <p className="text-display-3 text-fg-primary">
          {kpi.value}
          <span className="text-body-1 text-fg-muted"> {kpi.unit}</span>
        </p>
        <Sparkline values={kpi.series} label={`${kpi.label}, last 12 hours`} className="h-r1 w-full" />
        <p className="max-w-measure text-body-2 text-fg-secondary">{kpi.note}</p>
      </div>
    );
  }
  return (
    <ul ref={tiles} className="grid gap-r3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--COLUMN-SM)),1fr))]">
      {KPIS.map((k) => (
        <li key={k.id}>
          <button
            type="button"
            data-kpi={k.id}
            style={named(`sc-vt-kpi-${k.id}`)}
            onClick={() => go(k.id)}
            className="sc-vt-kpi grid w-full gap-r6 rounded-lg border border-border bg-surface-0 p-r3 text-start transition-colors hover:border-border-strong"
          >
            <span className="text-body-2 text-fg-secondary">{k.label}</span>
            <span className="text-h2 text-fg-primary">
              {k.value}
              <span className="text-body-2 text-fg-muted"> {k.unit}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

const PLANS = [
  { id: "starter", name: "Starter", monthly: 12, yearly: 120 },
  { id: "team", name: "Team", monthly: 29, yearly: 290 },
  { id: "business", name: "Business", monthly: 79, yearly: 790 },
];

/** Marketing: switching billing rolls each price out and the new one in, upward to yearly and back down. */
function PriceRoll() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  return (
    <div className="flex flex-col gap-r3">
      <SegmentedControl
        aria-label="Billing"
        value={billing}
        onValueChange={(next) => {
          const to = next === "yearly" ? "yearly" : "monthly";
          runTransition("roll", () => setBilling(to), { "--sc-vt-roll": to === "yearly" ? "1" : "-1" });
        }}
        className="self-start"
      >
        <SegmentedControl.Item value="monthly">Monthly</SegmentedControl.Item>
        <SegmentedControl.Item value="yearly">Yearly</SegmentedControl.Item>
      </SegmentedControl>
      <ul className="grid gap-r3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--COLUMN-SM)),1fr))]">
        {PLANS.map((p) => (
          <li key={p.id} className="grid gap-r5 rounded-lg border border-border bg-surface-0 p-r2">
            <span className="text-body-1 font-medium text-fg-secondary">{p.name}</span>
            <span data-price={p.id} style={named(`sc-vt-price-${p.id}`)} className="sc-vt-price text-display-3 text-fg-primary">
              ${billing === "yearly" ? p.yearly : p.monthly}
              <span className="text-body-1 text-fg-muted"> / {billing === "yearly" ? "year" : "month"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TOUR = [
  { icon: PenLine, title: "Write together", body: "Draft release notes with the people who shipped the work, in one document, in real time." },
  { icon: Users, title: "Review in place", body: "Comments sit next to the sentence they are about, and an approval is one click away." },
  { icon: Rocket, title: "Publish everywhere", body: "One press sends the notes to your changelog, your email list and your in-app inbox." },
];

/** Marketing: a feature tour whose steps slide in the direction you move (mirrored in RTL). */
function Tour() {
  const [step, setStep] = useState(0);
  const go = (to: number) => runTransition("tour", () => setStep(to), { "--sc-vt-dir": to > step ? "1" : "-1" });
  const { icon: Icon, title, body } = TOUR[step]!;
  return (
    <div className="grid gap-r3">
      <div
        data-sc="vt-tour-panel"
        style={named("sc-vt-tour")}
        className="sc-vt-tour grid min-h-section-1 content-center justify-items-start gap-r4 rounded-lg border border-border bg-surface-1 p-r1"
      >
        <span className="inline-grid size-control place-items-center rounded-md bg-primary text-fg-on-primary">
          <Icon aria-hidden className="size-icon" />
        </span>
        <h4 className="text-display-4 text-fg-primary">{title}</h4>
        <p className="max-w-measure text-prose-2 text-fg-secondary">{body}</p>
      </div>
      <div className="flex items-center gap-r4">
        <Button variant="secondary" iconStart={<ArrowLeft className="rtl:-scale-x-100" />} disabled={step === 0} onClick={() => go(step - 1)}>
          Previous
        </Button>
        <span className="text-body-2 text-fg-muted" aria-live="polite">
          Step {step + 1} of {TOUR.length}
        </span>
        <Button variant="secondary" iconEnd={<ArrowRight className="rtl:-scale-x-100" />} disabled={step === TOUR.length - 1} onClick={() => go(step + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** App: the next theme spreads from the press in a circle that grows to cover the screen. */
function ThemeReveal() {
  const { theme, setTheme } = useTheme(PREFERENCES);
  const at = THEMES.findIndex((t) => t.value === theme);
  const next = THEMES[(at + 1) % THEMES.length]!;
  const reveal = (event: MouseEvent<HTMLButtonElement>) => {
    // A keyboard press has no pointer position: spread from the button's centre.
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || (box.left + box.right) / 2;
    const y = event.clientY || (box.top + box.bottom) / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    runTransition("reveal", () => setTheme(next.value), {
      "--sc-vt-x": `${x}px`,
      "--sc-vt-y": `${y}px`,
      "--sc-vt-r": `${radius}px`,
    });
  };
  return (
    <Button variant="secondary" iconStart={<SunMoon />} onClick={reveal} className="justify-self-start">
      Switch to {next.label}
    </Button>
  );
}

export default function ViewTransitionSection() {
  return (
    <Stack>
      <Row label="Switch the layout: each card morphs from its old box to its new one">
        <LayoutSwitch />
      </Row>
      <Row label="Dashboard · drill down: a KPI tile grows into its detail panel, and Back shrinks it home">
        <DrillDown />
      </Row>
      <Row label="Marketing · pricing: each price rolls up to yearly, and back down to monthly">
        <PriceRoll />
      </Row>
      <Row label="Marketing · a feature tour: each step slides in from the side you are heading to">
        <Tour />
      </Row>
      <Row label="App · a theme switch: the new theme spreads from where you pressed">
        <ThemeReveal />
      </Row>
    </Stack>
  );
}
