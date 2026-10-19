/**
 * The Dashboard's fake data: seeded, so every load (and every screenshot) is
 * identical, and regenerated per query (time window, regions, environment) the
 * way a real query would be. Values are raw numbers; the cards format them
 * through `src/util/format.ts`.
 */

import type { SeriesSlot } from "../../../src/components/data";
import type { Tone } from "../../../src/components/primitives";

export type Env = "production" | "staging";

export const REGIONS = ["us-east", "eu-west", "ap-south", "sa-east"] as const;
export type Region = (typeof REGIONS)[number];
export const ERROR_KINDS = ["5xx server", "4xx client", "Timeouts"] as const;

/** Mulberry32 over a string hash: the same key always yields the same stream. */
function rng(key: string): () => number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
/** How far back the specimen keeps data: no time filter means all of it. */
export const RETENTION_DAYS = 90;

/** A query's time window, epoch ms. */
export interface TimeWindow {
  start: number;
  end: number;
}

/** Hourly up to two days, 4-hourly up to two weeks, daily beyond: 24 to 90 points for the presets. */
export function windowShape({ start, end }: TimeWindow): { points: number; stepHours: number } {
  const hours = Math.max(1, (end - start) / HOUR_MS);
  const stepHours = hours <= 48 ? 1 : hours <= 14 * 24 ? 4 : 24;
  return { points: Math.max(2, Math.round(hours / stepHours)), stepHours };
}

const REGION_BASE: Record<Region, number> = { "us-east": 1850, "eu-west": 1320, "ap-south": 880, "sa-east": 410 };

export interface Series {
  name: string;
  slot: SeriesSlot;
  values: number[];
}

export type KpiId = "requests" | "errorRate" | "p95" | "availability" | "users" | "cpu";

export interface Kpi {
  id: KpiId;
  value: number;
  /** The change vs the prior period, in the KPI's own delta unit (% or pp). */
  delta: number;
  trend: number[];
}

export type ServiceStatus = "critical" | "serious" | "warning" | "stale" | "good";

export interface Service {
  name: string;
  owner: string;
  status: ServiceStatus;
  rps: number | null;
  p95: number | null;
  /** Error ratio (0.0342 = 3.42%). */
  errors: number | null;
  /** CPU utilisation, 0–100. */
  cpu: number | null;
  /** Minutes since the last deploy. */
  deployedMin: number;
}

export interface Endpoint {
  name: string;
  p95: number;
  calls: number;
}

export interface DashboardData {
  /** One timestamp (epoch ms) per traffic and error point, oldest first. */
  times: number[];
  traffic: Series[];
  errors: Series[];
  /** 5xx errors by weekday (Mon first) × hour of day, over the last 7 days. */
  heat: number[][];
  kpis: Record<KpiId, Kpi>;
  services: Service[];
  endpoints: Endpoint[];
}

const SERVICES: [string, string, number | null, number | null, number | null, number | null, number][] = [
  ["api-gateway", "Edge", 3120, 142, 0.0021, 71, 180],
  ["auth", "Identity", 1480, 96, 0.0008, 44, 2900],
  ["billing", "Payments", 212, 310, 0.0034, 52, 12],
  ["checkout", "Payments", 388, 1240, 0.0342, 77, 95],
  ["search", "Discovery", 940, 912, 0.0062, 68, 6],
  ["inventory", "Commerce", 610, 188, 0.0012, 39, 5200],
  ["notifications", "Messaging", 455, 230, 0.0027, 33, 800],
  ["media-transcoder", "Media", 64, 640, 0.0044, 91, 260],
  ["recommendations", "Discovery", 720, 410, 0.0018, 62, 1500],
  ["ledger", "Payments", 180, 280, 0.0009, 86, 3400],
  ["webhooks", "Platform", 305, 520, 0.0112, 48, 610],
  ["analytics-ingest", "Data", 2240, 74, 0.0005, 81, 7200],
  ["feature-flags", "Platform", null, null, null, null, 9800],
  ["geo-router", "Edge", 1990, 38, 0.0002, 27, 11000],
];

const ENDPOINTS: [string, number][] = [
  ["POST /v2/checkout", 1240],
  ["GET /search", 912],
  ["POST /media/transcode", 780],
  ["GET /v1/ledger/entries", 640],
  ["POST /webhooks/dispatch", 520],
  ["GET /recommendations", 410],
  ["POST /auth/token", 260],
  ["GET /inventory/:sku", 190],
];

/** The services a team owns, in catalogue order. */
export function servicesOwnedBy(team: string): string[] {
  return SERVICES.filter(([, owner]) => owner === team).map(([name]) => name);
}

function statusOf(s: Omit<Service, "status" | "owner" | "name" | "deployedMin">): ServiceStatus {
  if (s.rps === null || s.p95 === null || s.errors === null) return "stale";
  if (s.errors > 0.02) return "critical";
  if (s.errors > 0.01 || s.p95 > 800) return "serious";
  if ((s.cpu ?? 0) > 80 || s.p95 > 500) return "warning";
  return "good";
}

/** "Now" for the specimen: local midnight, so ticks land on the reader's own day boundaries and ages read the same on every load. */
export const NOW = new Date(2026, 9, 15).getTime();
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** `regions` empty: every region. */
export function generate(window: TimeWindow, regions: readonly Region[], env: Env): DashboardData {
  const r = rng(`${window.start}|${window.end}|${env}`);
  const { points, stepHours } = windowShape(window);
  const envScale = env === "staging" ? 0.06 : 1;
  const shown: readonly Region[] = regions.length === 0 ? REGIONS : REGIONS.filter((name) => regions.includes(name));
  const totalBase = REGIONS.reduce((sum, name) => sum + REGION_BASE[name], 0);
  const share = shown.reduce((sum, name) => sum + REGION_BASE[name], 0) / totalBase;
  const daily = stepHours < 24;
  const times = Array.from({ length: points }, (_, i) => window.end - (points - 1 - i) * stepHours * HOUR_MS);

  const allTraffic: Series[] = REGIONS.map((name, ri) => ({
    name,
    slot: (ri + 1) as SeriesSlot,
    values: Array.from({ length: points }, (_, i) => {
      const hour = (i * stepHours) % 24;
      const wave = daily ? 1 + 0.38 * Math.sin(((hour - 8 + ri * 2.2) / 24) * Math.PI * 2) : 1;
      const day = Math.floor((i * stepHours) / 24) % 7;
      const weekly = day === 5 || day === 6 ? 0.78 : 1;
      const trend = 0.9 + 0.12 * (i / points);
      return Math.round(REGION_BASE[name] * wave * weekly * trend * (0.94 + r() * 0.12) * envScale);
    }),
  }));
  const traffic = allTraffic.filter((s) => shown.some((name) => name === s.name));

  const errors: Series[] = ERROR_KINDS.map((name, ci) => {
    const base = [38, 120, 11][ci] ?? 0;
    return {
      name,
      slot: (ci + 1) as SeriesSlot,
      values: Array.from({ length: points }, (_, i) => {
        // The open checkout incident: a 5xx spike in the two intervals up to now.
        const spike = ci === 0 && NOW - (times[i] ?? 0) < 2 * stepHours * HOUR_MS ? 2.8 + r() : 1;
        return Math.round(base * stepHours * share * envScale * spike * (0.75 + r() * 0.5));
      }),
    };
  });

  const walk = (start: number, drift: number, vol: number) => {
    const out = [start];
    for (let i = 1; i < 12; i++) out.push(Math.max(0, (out[i - 1] ?? start) * (1 + drift + (r() - 0.5) * vol)));
    return out;
  };
  const totalRequests = traffic.reduce(
    (sum, s) => sum + s.values.reduce((acc, v) => acc + v * stepHours * 3600, 0),
    0,
  );
  const kpis: Record<KpiId, Kpi> = {
    requests: { id: "requests", value: totalRequests, delta: 4.2 + r() * 2, trend: walk(100, 0.01, 0.08) },
    errorRate: { id: "errorRate", value: 0.38 + r() * 0.1, delta: -(0.05 + r() * 0.06), trend: walk(100, -0.02, 0.12) },
    p95: { id: "p95", value: 176 + r() * 20, delta: 9 + r() * 6, trend: walk(100, 0.015, 0.06) },
    availability: { id: "availability", value: 99.97, delta: 0, trend: walk(100, 0, 0.004) },
    users: { id: "users", value: (48200 + r() * 3000) * share * envScale, delta: 6.1 + r() * 2, trend: walk(100, 0.012, 0.07) },
    cpu: { id: "cpu", value: 58 + r() * 10, delta: 3 + r() * 2, trend: walk(100, 0.01, 0.05) },
  };

  const services: Service[] = SERVICES.map(([name, owner, rps, p95, err, cpu, deployedMin]) => {
    const j = 0.9 + r() * 0.2;
    const metrics = {
      rps: rps === null ? null : Math.round(rps * j * share * envScale),
      p95: p95 === null ? null : Math.round(p95 * j),
      errors: err,
      cpu: cpu === null ? null : Math.min(100, Math.round(cpu * j)),
    };
    return { name, owner, deployedMin, ...metrics, status: statusOf(metrics) };
  });

  // 5xx by weekday × hour: a business-hours hump, quieter weekends, and the
  // checkout incident on Thursday afternoon.
  const h5 = rng(`heat|${env}|${shown.join(",")}`);
  const heat = WEEKDAYS.map((_, d) =>
    Array.from({ length: 24 }, (__, h) => {
      const busy = Math.max(0.08, Math.sin(((h - 6) / 24) * Math.PI * 2));
      const weekend = d >= 5 ? 0.45 : 1;
      const incident = d === 3 && h >= 14 && h <= 16 ? 4.5 : 1;
      return Math.round(60 * busy * weekend * incident * share * envScale * (0.8 + h5() * 0.4));
    }),
  );

  const endpoints = ENDPOINTS.map(([name, ms]) => ({
    name,
    p95: Math.round(ms * (0.92 + r() * 0.16)),
    calls: Math.round((20000 + r() * 400000) * share * envScale),
  }));

  return { times, traffic, errors, heat, kpis, services, endpoints };
}

/** How each service status reads: tone (mark + glyph), word, and severity rank. */
export const STATUS: Record<ServiceStatus, { tone: Tone; label: string; rank: number }> = {
  critical: { tone: "error", label: "Critical", rank: 4 },
  serious: { tone: "serious", label: "Degraded", rank: 3 },
  warning: { tone: "warning", label: "Warning", rank: 2 },
  stale: { tone: "stale", label: "No data", rank: 1 },
  good: { tone: "success", label: "Healthy", rank: 0 },
};

export interface Incident {
  status: Extract<ServiceStatus, "critical" | "serious" | "warning">;
  title: string;
  service: string;
  region: string;
  ageMin: number;
  owner: string;
}

export const INCIDENTS: Incident[] = [
  { status: "critical", title: "Elevated 5xx on checkout", service: "checkout", region: "eu-west", ageMin: 14, owner: "Mia Rossi" },
  {
    status: "serious",
    title: "p95 regression in search after deploy 4f2a91c",
    service: "search",
    region: "all regions",
    ageMin: 52,
    owner: "Jon Tate",
  },
  { status: "warning", title: "Disk at 85% on ledger-db-2", service: "ledger", region: "us-east", ageMin: 190, owner: "Ama Kofi" },
  {
    status: "warning",
    title: "TLS certificate expires in 9 days: hooks.kestrel.dev",
    service: "webhooks",
    region: "global",
    ageMin: 1440,
    owner: "Sam Park",
  },
];

export interface Slo {
  service: string;
  /** The objective as a ratio (0.9995 = 99.95%). */
  target: number;
  /** Error budget left, 0–100. */
  left: number;
}

export const SLOS: Slo[] = [
  { service: "checkout", target: 0.9995, left: 18 },
  { service: "search", target: 0.999, left: 41 },
  { service: "api-gateway", target: 0.9999, left: 64 },
  { service: "billing", target: 0.9995, left: 77 },
  { service: "auth", target: 0.9999, left: 92 },
];

export type DeployStatus = "progress" | "good" | "rolledBack";

/** A staged rollout: hosts updated so far, through canary stages. */
export interface Rollout {
  stage: number;
  stages: number;
  hosts: number;
  of: number;
}

export interface Deploy {
  id: string;
  status: DeployStatus;
  service: string;
  version: string;
  author: string;
  ageMin: number;
  /** While `status` is `progress`. */
  rollout?: Rollout;
}

export const DEPLOYS: Deploy[] = [
  {
    id: "d1",
    status: "progress",
    service: "search",
    version: "4f2a91c",
    author: "@jt",
    ageMin: 6,
    rollout: { stage: 3, stages: 5, hosts: 31, of: 50 },
  },
  { id: "d2", status: "good", service: "billing", version: "v2.14.0", author: "@mia", ageMin: 12 },
  { id: "d3", status: "rolledBack", service: "checkout", version: "v5.3.1", author: "@raf", ageMin: 95 },
  { id: "d4", status: "good", service: "api-gateway", version: "v9.0.2", author: "@devon", ageMin: 180 },
  { id: "d5", status: "good", service: "media-transcoder", version: "a81c02e", author: "@kim", ageMin: 260 },
  { id: "d6", status: "good", service: "webhooks", version: "v1.8.7", author: "@sp", ageMin: 610 },
];

export interface Team {
  onCall: string;
  channel: string;
}

/** Who answers for each owning team: what a team's hover card previews. */
export const TEAMS: Record<string, Team> = {
  Edge: { onCall: "Devon Hale", channel: "#edge-oncall" },
  Identity: { onCall: "Priya Nair", channel: "#identity" },
  Payments: { onCall: "Mia Rossi", channel: "#payments-oncall" },
  Discovery: { onCall: "Jon Tate", channel: "#discovery" },
  Commerce: { onCall: "Lena Vogel", channel: "#commerce" },
  Messaging: { onCall: "Omar Haddad", channel: "#messaging" },
  Media: { onCall: "Kim Seo-yeon", channel: "#media-pipeline" },
  Platform: { onCall: "Sam Park", channel: "#platform" },
  Data: { onCall: "Ama Kofi", channel: "#data-eng" },
};

/** The maintenance window the dashboard's banner announces: two days after "now". */
export const MAINTENANCE = { start: NOW + 2 * DAY_MS + 2 * HOUR_MS, end: NOW + 2 * DAY_MS + 3 * HOUR_MS, region: "eu-west" };
