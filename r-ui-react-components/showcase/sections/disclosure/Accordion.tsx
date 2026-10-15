import { useState } from "react";

import { Button } from "../../../src/components/primitives";
import { Accordion } from "../../../src/components/disclosure";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "Accordion",
  group: "disclosure",
  order: 10,
  description:
    "Headings with buttons that show and hide their regions. Single or multiple, controlled or not; arrows move between headers, Home/End jump, disabled items are skipped. Panels animate their height; reduced motion makes it instant.",
};

const ITEMS = [
  {
    value: "alerts",
    title: "Which alerts page someone?",
    body: "Only alerts marked urgent. Everything else waits for the morning digest, grouped by service.",
  },
  {
    value: "routing",
    title: "How is an incident routed to the right team when the owning service has been renamed twice since the alert was written?",
    body: "Ownership follows the service's id, not its name, so renames never strand an alert. The history panel shows every name the service has had.",
  },
  {
    value: "export",
    title: "Can we export the timeline?",
    body: "As CSV or JSON, from the incident's menu. Exports include every status change and who made it.",
  },
  // Last, so a check that End lands on the last ENABLED header can fail.
  { value: "retention", title: "How long are incidents kept?", body: "Thirteen months, then summarised.", disabled: true },
];

function Example(props: { multiple?: boolean; defaultValue?: string; collapsible?: boolean }) {
  const items = ITEMS.map(({ value, title, body, disabled }) => (
    <Accordion.Item key={value} value={value} disabled={disabled}>
      <Accordion.Trigger>{title}</Accordion.Trigger>
      <Accordion.Content>{body}</Accordion.Content>
    </Accordion.Item>
  ));
  return props.multiple ? (
    <Accordion multiple defaultValue={props.defaultValue ? [props.defaultValue] : []}>
      {items}
    </Accordion>
  ) : (
    <Accordion defaultValue={props.defaultValue} collapsible={props.collapsible}>
      {items}
    </Accordion>
  );
}

function Controlled() {
  const [open, setOpen] = useState<string | null>("alerts");
  return (
    <div className="flex flex-col gap-r4">
      <div className="flex flex-wrap items-center gap-r4">
        <Button variant="secondary" onClick={() => setOpen("export")}>
          Open “export”
        </Button>
        <Button variant="ghost" onClick={() => setOpen(null)}>
          Close all
        </Button>
        <span className="text-body-2 text-fg-secondary">
          value: <code className="font-mono">{open ?? "null"}</code>
        </span>
      </div>
      <Accordion value={open} onValueChange={setOpen}>
        {ITEMS.map(({ value, title, body }) => (
          <Accordion.Item key={value} value={value}>
            <Accordion.Trigger>{title}</Accordion.Trigger>
            <Accordion.Content>{body}</Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
}

export default function AccordionSection() {
  return (
    <Stack>
      <Row label="Single (default) · a long question wraps · a disabled item">
        <div className="max-w-measure" data-sc="accordion-single">
          <Example defaultValue="alerts" />
        </div>
      </Row>
      <Row label="Multiple · several open at once">
        <div className="max-w-measure">
          <Example multiple defaultValue="routing" />
        </div>
      </Row>
      <Row label="Single, not collapsible · the open header is aria-disabled">
        <div className="max-w-measure">
          <Example defaultValue="alerts" collapsible={false} />
        </div>
      </Row>
      <Row label="Controlled from outside">
        <div className="max-w-measure">
          <Controlled />
        </div>
      </Row>
      <Row label="Compact density">
        <div className="max-w-measure" data-density="compact">
          <Example defaultValue="export" />
        </div>
      </Row>
      <Row label="RTL">
        <div className="max-w-measure" dir="rtl">
          <Accordion defaultValue="a">
            <Accordion.Item value="a">
              <Accordion.Trigger>ما التنبيهات التي توقظ أحدًا؟</Accordion.Trigger>
              <Accordion.Content>التنبيهات العاجلة فقط.</Accordion.Content>
            </Accordion.Item>
            <Accordion.Item value="b">
              <Accordion.Trigger>هل يمكن تصدير الجدول الزمني؟</Accordion.Trigger>
              <Accordion.Content>نعم، بصيغة CSV أو JSON.</Accordion.Content>
            </Accordion.Item>
          </Accordion>
        </div>
      </Row>
    </Stack>
  );
}
