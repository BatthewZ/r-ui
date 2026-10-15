// The "Create alert rule" demo's model: a hand-written Standard Schema (any
// validator that implements the spec would do; the demo takes no dependency),
// an async name check, and a pretend rule service.

import type { StandardSchemaIssue, StandardSchemaV1 } from "../../../../src/components/form";
import { formatNumber } from "../../../../src/util/format";

export const METRICS = [
  { value: "cpu", label: "CPU usage", unit: "%", max: 100 },
  { value: "memory", label: "Memory usage", unit: "%", max: 100 },
  { value: "latency", label: "p95 latency", unit: "ms", max: 60_000 },
  { value: "errors", label: "Error rate", unit: "%", max: 100 },
  { value: "queue", label: "Queue depth", unit: "jobs", max: 1_000_000 },
] as const;

export const SERVICES = ["checkout-api", "payments-worker", "search-indexer", "notifications"] as const;

export const CHANNELS = [
  { value: "ops-alerts", label: "#ops-alerts" },
  { value: "payments", label: "#payments-oncall" },
  { value: "email", label: "Team email list" },
  { value: "statuspage", label: "Status page draft" },
];

export interface ConditionInput {
  metric: string;
  operator: "above" | "below";
  threshold: number | null;
}

/** What the form holds. */
export interface AlertRuleInput {
  name: string;
  service: string;
  severity: string;
  window: string;
  conditions: ConditionInput[];
  forMinutes: number | null;
  runbook: string;
  page: boolean;
  /** Extra channels told when it fires. */
  notify: string[];
  muteWeekends: boolean;
}

/** What the schema parses it into: trimmed, and every number present. */
export interface AlertRule extends Omit<AlertRuleInput, "conditions" | "forMinutes"> {
  conditions: Array<Omit<ConditionInput, "threshold"> & { threshold: number }>;
  forMinutes: number;
}

export const EMPTY_CONDITION: ConditionInput = { metric: "", operator: "above", threshold: null };

export const DEFAULT_RULE: AlertRuleInput = {
  name: "",
  service: "",
  severity: "p2",
  window: "5m",
  conditions: [{ metric: "cpu", operator: "above", threshold: 90 }],
  forMinutes: 5,
  runbook: "",
  page: true,
  notify: ["ops-alerts"],
  muteWeekends: false,
};

export const metricOf = (value: string) => METRICS.find((m) => m.value === value);

export const alertRuleSchema: StandardSchemaV1<AlertRuleInput, AlertRule> = {
  "~standard": {
    version: 1,
    vendor: "showcase",
    validate(input) {
      const rule = input as AlertRuleInput;
      const issues: StandardSchemaIssue[] = [];
      const at = (message: string, ...path: Array<string | number>) => issues.push({ message, path });
      const name = rule.name.trim();
      if (!name) at("Enter a rule name", "name");
      else if (!/^[a-z0-9-]+$/.test(name)) at("Use lowercase letters, digits and hyphens only", "name");
      if (!rule.service) at("Choose the service this rule watches", "service");
      if (rule.conditions.length === 0) at("Add at least one condition", "conditions");
      rule.conditions.forEach((condition, i) => {
        const metric = metricOf(condition.metric);
        if (!metric) at("Choose a metric", "conditions", i, "metric");
        if (condition.threshold === null) at("Enter a threshold", "conditions", i, "threshold");
        else if (metric && (condition.threshold < 0 || condition.threshold > metric.max)) {
          at(`Between 0 and ${formatNumber(metric.max)} ${metric.unit}`, "conditions", i, "threshold");
        }
      });
      if (rule.forMinutes === null || rule.forMinutes < 1) at("Hold for at least 1 minute", "forMinutes");
      // Across fields: a rule that wakes someone up must say what to do.
      if (rule.page && !rule.runbook.trim()) at("Paging rules need a runbook note", "runbook");
      if (issues.length) return { issues };
      return {
        value: {
          ...rule,
          name,
          runbook: rule.runbook.trim(),
          conditions: rule.conditions.map((c) => ({ ...c, threshold: c.threshold as number })),
          forMinutes: rule.forMinutes as number,
        },
      };
    },
  },
};

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

const TAKEN = new Set(["cpu-high", "disk-full", "checkout-latency"]);

/** "Is this name free?", as a server would answer it: slowly, and cancellable. */
export async function checkNameFree(value: unknown, { signal }: { signal: AbortSignal }) {
  await wait(700, signal);
  const name = String(value).trim();
  return TAKEN.has(name) ? `“${name}” is already used by another rule` : undefined;
}

export type ServerMode = "saves" | "rejects" | "down";

/** The pretend rule service: errors by path, the way an API returns them. */
export async function saveRule(rule: AlertRule, mode: ServerMode): Promise<Record<string, string> | null> {
  await wait(900);
  if (mode === "down") return { "": "The rule service didn't answer. Your changes are kept; try again." };
  if (mode === "rejects") {
    const index = rule.conditions.findIndex((c) => c.metric === "cpu" || c.metric === "memory");
    return index === -1
      ? { "conditions[0].metric": "This service doesn't report that metric" }
      : { [`conditions[${index}].threshold`]: "Above this service's ceiling: alerts fire from 95% at most" };
  }
  TAKEN.add(rule.name);
  return null;
}
