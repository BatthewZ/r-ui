/** Sample data for the data-group sections. Deterministic, with real-content edge cases. */

export type ServiceStatus = "success" | "warning" | "serious" | "error" | "stale";

export interface Service {
  id: string;
  name: string;
  owner: string;
  status: ServiceStatus;
  rps: number | null;
  p95: number | null;
  errorRate: number | null;
  cpu: number | null;
  deployedMinutesAgo: number;
}

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  success: "Healthy",
  warning: "Warning",
  serious: "Degraded",
  error: "Down",
  stale: "No data",
};

export const STATUS_RANK: Record<ServiceStatus, number> = { success: 0, stale: 1, warning: 2, serious: 3, error: 4 };

export const SERVICES: Service[] = [
  { id: "api", name: "api-gateway", owner: "platform", status: "success", rps: 18420, p95: 84, errorRate: 0.0012, cpu: 62, deployedMinutesAgo: 42 },
  { id: "checkout", name: "checkout", owner: "payments", status: "serious", rps: 2310, p95: 640, errorRate: 0.0431, cpu: 91, deployedMinutesAgo: 18 },
  { id: "search", name: "search", owner: "discovery", status: "warning", rps: 6120, p95: 212, errorRate: 0.0087, cpu: 83, deployedMinutesAgo: 380 },
  { id: "auth", name: "auth", owner: "identity", status: "success", rps: 9480, p95: 41, errorRate: 0.0003, cpu: 38, deployedMinutesAgo: 2880 },
  { id: "billing", name: "billing", owner: "payments", status: "success", rps: 410, p95: 120, errorRate: 0.0021, cpu: 27, deployedMinutesAgo: 1440 },
  {
    id: "recs",
    name: "recommendations-feature-store-materializer",
    owner: "machine-learning-infrastructure",
    status: "stale",
    rps: null,
    p95: null,
    errorRate: null,
    cpu: null,
    deployedMinutesAgo: 10080,
  },
  { id: "notify", name: "notifications", owner: "growth", status: "error", rps: 0, p95: 4210, errorRate: 0.62, cpu: 4, deployedMinutesAgo: 6 },
  { id: "media", name: "media-transcoder", owner: "content", status: "success", rps: 87, p95: 1830, errorRate: 0.0009, cpu: 74, deployedMinutesAgo: 720 },
];

export function ago(minutes: number): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto", style: "short" });
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), "hour");
  return rtf.format(-Math.round(minutes / 1440), "day");
}

/** A cheap seeded PRNG so 10,000 rows are the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export interface Request {
  id: number;
  path: string;
  method: string;
  status: number;
  ms: number;
  bytes: number;
  region: string;
}

const PATHS = ["/v1/orders", "/v1/orders/{id}", "/v1/search", "/v2/catalog/items", "/auth/token", "/v1/users/{id}/preferences/notifications", "/health"];
const METHODS = ["GET", "GET", "GET", "POST", "PUT", "DELETE"];
const REGIONS = ["us-east", "eu-west", "ap-south", "sa-east"];

export function makeRequests(count: number): Request[] {
  const r = rng(7);
  return Array.from({ length: count }, (_, i) => {
    const roll = r();
    return {
      id: i + 1,
      path: PATHS[Math.floor(r() * PATHS.length)] ?? "/",
      method: METHODS[Math.floor(r() * METHODS.length)] ?? "GET",
      status: roll > 0.97 ? 503 : roll > 0.92 ? 404 : 200,
      ms: Math.round(8 + r() ** 3 * 1800),
      bytes: Math.round(r() * 2_000_000),
      region: REGIONS[Math.floor(r() * REGIONS.length)] ?? "us-east",
    };
  });
}

export function series(seed: number, n: number, base: number, swing: number): number[] {
  const r = rng(seed);
  let v = base;
  return Array.from({ length: n }, () => {
    v = Math.max(0, v + (r() - 0.5) * swing);
    return Math.round(v * 10) / 10;
  });
}
