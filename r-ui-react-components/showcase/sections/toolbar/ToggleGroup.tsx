import { Bell, Bold, Italic, Mail, MessageSquare, TextAlignCenter, TextAlignEnd, TextAlignStart, Underline } from "lucide-react";
import { useState } from "react";

import { Field, Form, useForm, useFormValue } from "../../../src/components/form";
import { Button } from "../../../src/components/primitives";
import { ToggleGroup } from "../../../src/components/toolbar";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "ToggleGroup",
  group: "toolbar",
  order: 20,
  description:
    "Toggles that share one job. Multiple: independent aria-pressed buttons (bold, italic). Single: a radio group of toggles (alignment), whose choice moves but never clears. Standalone it is one tab stop with its own arrows (a single group checks as it moves); inside a Toolbar the toolbar owns the arrows. In a Field it is a form control.",
};

const DAYS = [
  ["mon", "Mon"],
  ["tue", "Tue"],
  ["wed", "Wed"],
  ["thu", "Thu"],
  ["fri", "Fri"],
] as const;

export default function ToggleGroupSection() {
  const [style, setStyle] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState("start");

  return (
    <Stack>
      <Row label="Multiple: icon-only (named by label) · text · icon + text">
        <div className="flex flex-wrap items-center gap-r3" data-sc="toggle-multiple">
          <ToggleGroup type="multiple" aria-label="Text style" value={style} onValueChange={setStyle}>
            <ToggleGroup.Item value="bold" icon={<Bold />} label="Bold" />
            <ToggleGroup.Item value="italic" icon={<Italic />} label="Italic" />
            <ToggleGroup.Item value="underline" icon={<Underline />} label="Underline" />
          </ToggleGroup>
          <ToggleGroup type="multiple" aria-label="Columns" defaultValue={["name", "status"]}>
            <ToggleGroup.Item value="name">Name</ToggleGroup.Item>
            <ToggleGroup.Item value="status">Status</ToggleGroup.Item>
            <ToggleGroup.Item value="owner">Owner</ToggleGroup.Item>
          </ToggleGroup>
          <ToggleGroup type="multiple" aria-label="Notify by" defaultValue={["email"]}>
            <ToggleGroup.Item value="email" icon={<Mail />}>
              Email
            </ToggleGroup.Item>
            <ToggleGroup.Item value="chat" icon={<MessageSquare />}>
              Chat
            </ToggleGroup.Item>
            <ToggleGroup.Item value="push" icon={<Bell />}>
              Push
            </ToggleGroup.Item>
          </ToggleGroup>
          <output className="text-body-2 text-fg-secondary">Style: {style.join(", ") || "—"}</output>
        </div>
      </Row>

      <Row label="Single: a radio group; the tab stop is the checked one and the arrows check as they move">
        <div className="flex flex-wrap items-center gap-r3" data-sc="toggle-single">
          <ToggleGroup type="single" aria-label="Alignment" value={align} onValueChange={setAlign}>
            <ToggleGroup.Item value="start" icon={<TextAlignStart />} label="Align start" />
            <ToggleGroup.Item value="center" icon={<TextAlignCenter />} label="Align centre" />
            <ToggleGroup.Item value="end" icon={<TextAlignEnd />} label="Align end" />
          </ToggleGroup>
          <output className="text-body-2 text-fg-secondary">Alignment: {align}</output>
        </div>
      </Row>

      <Row label="Empty (nothing chosen yet) · a disabled item · the whole group disabled">
        <div className="flex flex-wrap items-center gap-r3">
          <ToggleGroup type="single" aria-label="Size">
            <ToggleGroup.Item value="s">S</ToggleGroup.Item>
            <ToggleGroup.Item value="m">M</ToggleGroup.Item>
            <ToggleGroup.Item value="l">L</ToggleGroup.Item>
          </ToggleGroup>
          <ToggleGroup type="multiple" aria-label="Channels" defaultValue={["web"]}>
            <ToggleGroup.Item value="web">Web</ToggleGroup.Item>
            <ToggleGroup.Item value="ios" disabled>
              iOS
            </ToggleGroup.Item>
            <ToggleGroup.Item value="android">Android</ToggleGroup.Item>
          </ToggleGroup>
          <ToggleGroup type="multiple" aria-label="Locked style" defaultValue={["bold"]} disabled>
            <ToggleGroup.Item value="bold" icon={<Bold />} label="Bold" />
            <ToggleGroup.Item value="italic" icon={<Italic />} label="Italic" />
          </ToggleGroup>
        </div>
      </Row>

      <Row label="A form control: bound through Field, validated on submit, submitted as one value per pressed toggle">
        <WorkingDays />
      </Row>

      <Row label="Vertical · compact · right to left (arrows mirror) · long labels wrap the row, never the toggle">
        <div className="flex flex-wrap items-start gap-r3">
          <ToggleGroup type="single" aria-label="View" defaultValue="list" orientation="vertical">
            <ToggleGroup.Item value="list">List</ToggleGroup.Item>
            <ToggleGroup.Item value="board">Board</ToggleGroup.Item>
            <ToggleGroup.Item value="calendar">Calendar</ToggleGroup.Item>
          </ToggleGroup>
          <div data-density="compact">
            <ToggleGroup type="multiple" aria-label="Compact style" defaultValue={["italic"]}>
              <ToggleGroup.Item value="bold" icon={<Bold />} label="Bold" />
              <ToggleGroup.Item value="italic" icon={<Italic />} label="Italic" />
              <ToggleGroup.Item value="underline" icon={<Underline />} label="Underline" />
            </ToggleGroup>
          </div>
          <div dir="rtl" data-sc="toggle-rtl">
            <ToggleGroup type="single" aria-label="المحاذاة" defaultValue="start">
              <ToggleGroup.Item value="start" icon={<TextAlignStart />} label="محاذاة إلى البداية" />
              <ToggleGroup.Item value="center" icon={<TextAlignCenter />} label="توسيط" />
              <ToggleGroup.Item value="end" icon={<TextAlignEnd />} label="محاذاة إلى النهاية" />
            </ToggleGroup>
          </div>
          <ToggleGroup type="multiple" aria-label="Benachrichtigungen" className="flex-wrap">
            <ToggleGroup.Item value="mail">Benachrichtigung per E-Mail</ToggleGroup.Item>
            <ToggleGroup.Item value="push">Mitteilungen auf dem Mobilgerät</ToggleGroup.Item>
          </ToggleGroup>
        </div>
      </Row>
    </Stack>
  );
}

function WorkingDays() {
  const [submitted, setSubmitted] = useState<string>("—");
  const form = useForm<{ days: string[] }>({
    defaultValues: { days: [] },
    onSubmit: (values) => setSubmitted(values.days.join(", ")),
  });
  const days = useFormValue<string[]>("days", form);
  return (
    <Form form={form} className="grid max-w-column-lg gap-r4" data-sc="toggle-form">
      <Field
        name="days"
        validate={(value) => (Array.isArray(value) && value.length > 0 ? undefined : "Choose at least one working day.")}
      >
        <Field.Label>Working days</Field.Label>
        <ToggleGroup type="multiple">
          {DAYS.map(([value, text]) => (
            <ToggleGroup.Item key={value} value={value}>
              {text}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
        <Field.Description>Selected: {days.join(", ") || "none"}</Field.Description>
        <Field.Error />
      </Field>
      <div className="flex flex-wrap items-center gap-r4">
        <Button type="submit">Save schedule</Button>
        <output className="text-body-2 text-fg-secondary">Submitted: {submitted}</output>
      </div>
    </Form>
  );
}
