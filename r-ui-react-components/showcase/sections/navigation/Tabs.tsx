import { FileText, ScrollText, Waypoints } from "lucide-react";
import { useState } from "react";

import { Stack } from "../../../src/components/layout";
import { Tabs } from "../../../src/components/navigation";
import { Row } from "./parts/demo";

export const meta = {
  title: "Tabs",
  group: "navigation",
  order: 20,
  description:
    "Underline and enclosed (segmented) variants. One tab stop; arrows move (mirrored in RTL), Home/End jump, disabled tabs are skipped. Automatic activation selects as focus moves; manual waits for Enter or Space.",
};

const PANELS = [
  { value: "overview", label: "Overview", body: "Golden signals for the last hour." },
  { value: "logs", label: "Logs", body: "1,204 lines matched." },
  { value: "traces", label: "Traces", body: "Slowest spans first." },
  { value: "config", label: "Configuration", body: "Read-only in production." },
];

function Example({
  variant,
  activation,
  icons,
  disabled,
}: {
  variant?: "underline" | "enclosed";
  activation?: "automatic" | "manual";
  icons?: boolean;
  disabled?: string;
}) {
  const ICON = { overview: FileText, logs: ScrollText, traces: Waypoints, config: FileText } as const;
  return (
    <Tabs defaultValue="overview" variant={variant} activation={activation}>
      <Tabs.List data-sc-scrolls aria-label="Service details">
        {PANELS.map(({ value, label }) => {
          const Icon = ICON[value as keyof typeof ICON];
          return (
            <Tabs.Tab key={value} value={value} disabled={value === disabled} icon={icons ? <Icon aria-hidden /> : undefined}>
              {label}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
      {PANELS.map(({ value, body }) => (
        <Tabs.Panel key={value} value={value} className="text-fg-secondary">
          {body}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

function Controlled() {
  const [range, setRange] = useState("24h");
  return (
    <Tabs value={range} onValueChange={setRange} variant="enclosed">
      <Tabs.List data-sc-scrolls aria-label="Time range">
        {["1h", "24h", "7d", "30d"].map((r) => (
          <Tabs.Tab key={r} value={r}>
            {r}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {["1h", "24h", "7d", "30d"].map((r) => (
        <Tabs.Panel key={r} value={r} className="text-fg-secondary">
          Showing the last {r} (controlled: <code>{range}</code>)
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

export default function TabsSection() {
  return (
    <Stack gap="r1">
      <Row label="Underline · automatic · one disabled">
        <Example disabled="traces" />
      </Row>
      <Row label="The selected tab is disabled: the first enabled tab is the tab stop">
        <div data-sc="tabs-disabled-selected" className="min-w-0">
          <Example disabled="overview" />
        </div>
      </Row>
      <Row label="Underline · icons · manual activation">
        <Example icons activation="manual" />
      </Row>
      <Row label="Enclosed (segmented) · controlled">
        <Controlled />
      </Row>
      <Row label="Overflow: a narrow container scrolls the list">
        <div className="w-1/2 min-w-0">
          <Example />
        </div>
      </Row>
      <Row label="Right-to-left">
        <div dir="rtl" className="min-w-0">
          <Example variant="enclosed" />
        </div>
      </Row>
    </Stack>
  );
}
