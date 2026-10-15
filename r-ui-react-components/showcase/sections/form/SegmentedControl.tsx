import { BarChart3, LineChart, List, Table2 } from "lucide-react";
import { useState } from "react";

import { Field, SegmentedControl } from "../../../src/components/form";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "SegmentedControl",
  group: "form",
  order: 90,
  description:
    "One choice among a few views. Radio-group semantics: one tab stop (the selected segment), arrows move and select. Selected = raised + bordered + inked, never a fill step alone.",
};

export default function SegmentedControlSection() {
  const [range, setRange] = useState("week");
  return (
    <Stack>
      <Row label="Text segments (controlled)">
        <div className="flex flex-wrap items-center gap-r3">
          <SegmentedControl aria-label="Range" value={range} onValueChange={setRange}>
            <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
            <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
            <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
          </SegmentedControl>
          <span className="text-body-2 text-fg-muted">Showing: {range}</span>
        </div>
      </Row>
      <Row label="Icon + text · icon only (named by aria-label)">
        <div className="flex flex-wrap items-center gap-r3">
          <SegmentedControl aria-label="Chart" defaultValue="line">
            <SegmentedControl.Item value="line" icon={<LineChart />}>
              Line
            </SegmentedControl.Item>
            <SegmentedControl.Item value="bar" icon={<BarChart3 />}>
              Bar
            </SegmentedControl.Item>
          </SegmentedControl>
          <SegmentedControl aria-label="Layout" defaultValue="table">
            <SegmentedControl.Item value="table" icon={<Table2 />} aria-label="Table" />
            <SegmentedControl.Item value="list" icon={<List />} aria-label="List" />
          </SegmentedControl>
        </div>
      </Row>
      <Row label="Full width, in a Field">
        <Field>
          <Field.Label>Granularity</Field.Label>
          <SegmentedControl defaultValue="5m" className="w-full">
            <SegmentedControl.Item value="1m">1 min</SegmentedControl.Item>
            <SegmentedControl.Item value="5m">5 min</SegmentedControl.Item>
            <SegmentedControl.Item value="1h">1 hour</SegmentedControl.Item>
            <SegmentedControl.Item value="1d">1 day</SegmentedControl.Item>
          </SegmentedControl>
        </Field>
      </Row>
      <Row label="States: one disabled segment · disabled · read-only · invalid · nothing selected">
        <div className="flex flex-wrap items-center gap-r3">
          <SegmentedControl aria-label="Env" defaultValue="prod">
            <SegmentedControl.Item value="prod">Production</SegmentedControl.Item>
            <SegmentedControl.Item value="staging">Staging</SegmentedControl.Item>
            <SegmentedControl.Item value="dev" disabled>
              Dev
            </SegmentedControl.Item>
          </SegmentedControl>
          <SegmentedControl aria-label="Disabled" defaultValue="a" disabled>
            <SegmentedControl.Item value="a">On</SegmentedControl.Item>
            <SegmentedControl.Item value="b">Off</SegmentedControl.Item>
          </SegmentedControl>
          <SegmentedControl aria-label="Read-only" defaultValue="b" readOnly>
            <SegmentedControl.Item value="a">Read</SegmentedControl.Item>
            <SegmentedControl.Item value="b">Only</SegmentedControl.Item>
          </SegmentedControl>
          <SegmentedControl aria-label="Invalid" invalid>
            <SegmentedControl.Item value="a">Pick</SegmentedControl.Item>
            <SegmentedControl.Item value="b">One</SegmentedControl.Item>
          </SegmentedControl>
        </div>
      </Row>
      <Row label="Compact · RTL (arrows follow the reading direction)">
        <div className="flex flex-wrap items-center gap-r3">
          <div data-density="compact">
            <SegmentedControl aria-label="Compact range" defaultValue="d">
              <SegmentedControl.Item value="d">Day</SegmentedControl.Item>
              <SegmentedControl.Item value="w">Week</SegmentedControl.Item>
              <SegmentedControl.Item value="m">Month</SegmentedControl.Item>
            </SegmentedControl>
          </div>
          <div dir="rtl">
            <SegmentedControl aria-label="النطاق" defaultValue="d">
              <SegmentedControl.Item value="d">يوم</SegmentedControl.Item>
              <SegmentedControl.Item value="w">أسبوع</SegmentedControl.Item>
              <SegmentedControl.Item value="m">شهر</SegmentedControl.Item>
            </SegmentedControl>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
