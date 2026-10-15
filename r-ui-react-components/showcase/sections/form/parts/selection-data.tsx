import { Database, Globe, Server, Zap } from "lucide-react";

import type { ComboboxOption } from "../../../../src/components/form";

/** Demo data for the selection-input sections. In a subfolder, which the section registry does not glob. */
export const SERVICES: ComboboxOption[] = [
  { value: "checkout-api", label: "Checkout API", description: "HTTP · 14 instances", icon: <Server />, group: "Payments" },
  { value: "payments-worker", label: "Payments worker", description: "Queue consumer", icon: <Zap />, group: "Payments" },
  { value: "ledger-db", label: "Ledger database", description: "Primary + 2 replicas", icon: <Database />, group: "Payments" },
  { value: "search-indexer", label: "Search indexer", description: "Paused for maintenance", icon: <Zap />, group: "Discovery", disabled: true },
  { value: "search-api", label: "Search API", description: "HTTP · 6 instances", icon: <Server />, group: "Discovery" },
  { value: "edge-zurich", label: "Zürich edge", description: "CDN point of presence", icon: <Globe />, group: "Edge" },
  { value: "edge-sao-paulo", label: "São Paulo edge", description: "CDN point of presence", icon: <Globe />, group: "Edge" },
  {
    value: "notifications",
    label: "Notifications fan-out and delivery-receipt reconciliation service",
    description: "A deliberately long name: the row truncates, the field keeps it whole on hover",
    icon: <Zap />,
    group: "Platform",
  },
];

export const REGIONS: ComboboxOption[] = [
  { value: "eu-west-1", label: "Europe (Ireland)", group: "Europe" },
  { value: "eu-central-1", label: "Europe (Frankfurt)", group: "Europe" },
  { value: "eu-north-1", label: "Europe (Stockholm)", group: "Europe" },
  { value: "us-east-1", label: "US East (N. Virginia)", group: "Americas" },
  { value: "us-west-2", label: "US West (Oregon)", group: "Americas" },
  { value: "sa-east-1", label: "South America (São Paulo)", group: "Americas" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)", group: "Asia Pacific" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)", group: "Asia Pacific", disabled: true },
];

export const LABEL_SUGGESTIONS = ["p1", "p2", "p3", "checkout", "customer-facing", "data-loss", "flaky", "regression", "security"];

/** Lower-case words, digits and dashes; at most 24 characters. */
export function validateLabel(tag: string): string | null {
  if (tag.length > 24) return `“${tag.slice(0, 24)}…” is longer than 24 characters.`;
  if (!/^[a-z0-9-]+$/.test(tag)) return `“${tag}” may use only a–z, 0–9 and dashes.`;
  return null;
}

/** 5,000 hosts, to show the windowed list. */
export const HOSTS: ComboboxOption[] = Array.from({ length: 5000 }, (_, i) => {
  const region = REGIONS[i % REGIONS.length]!;
  return {
    value: `host-${i}`,
    label: `ip-10-${(i >> 8) & 255}-${i & 255}.${region.value}.internal`,
    description: region.label,
  };
});
