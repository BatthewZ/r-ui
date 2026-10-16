import { useEffect, useRef, useState } from "react";

import { Field, Form, FormActions, Slider, useForm } from "../../../src/components/form";
import { Spinner } from "../../../src/components/primitives";
import { formatNumber } from "../../../src/util/format";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Slider",
  group: "form",
  order: 101,
  description:
    "A number on a scale (APG slider): drag anywhere on the strip or use arrows, Page Up/Down, Shift + arrow and Home/End (mirrored in RTL). Marks with labels, the value spoken through aria-valuetext in the locale, an optional value bubble, onValueChange as it moves and onValueCommit once per gesture. Bound through Field.",
};

const PERCENT = { style: "unit", unit: "percent" } as const;
const THRESHOLD_MARKS = [
  { value: 0, label: "0%" },
  { value: 50, label: "Warn" },
  { value: 80, label: "Page" },
  { value: 100, label: "100%" },
];

/** The alert threshold: every change shows at once, the commit count proves one per gesture. */
function Threshold() {
  const [value, setValue] = useState(70);
  const [committed, setCommitted] = useState<number | null>(null);
  const [commits, setCommits] = useState(0);
  return (
    <Field data-sc="slider-threshold">
      <Field.Label>CPU alert threshold</Field.Label>
      <Slider
        value={value}
        onValueChange={setValue}
        onValueCommit={(next) => {
          setCommitted(next);
          setCommits((n) => n + 1);
        }}
        step={5}
        marks={THRESHOLD_MARKS}
        formatOptions={PERCENT}
        showValue
      />
      <Field.Description>
        <span data-sc="slider-readout">
          Now {formatNumber(value, PERCENT)} · saved {committed === null ? "—" : formatNumber(committed, PERCENT)} ·{" "}
          <span data-sc="slider-commits">{commits}</span> {commits === 1 ? "save" : "saves"}
        </span>
      </Field.Description>
    </Field>
  );
}

/** A setting that saves on commit, disabled (with a spinner) while the save is in flight. */
function SavingSetting() {
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Field disabled={saving}>
      <Field.Label>Retention</Field.Label>
      <Slider
        defaultValue={30}
        min={1}
        max={90}
        formatValue={(days) => `${days} ${days === 1 ? "day" : "days"}`}
        onValueCommit={() => {
          setSaving(true);
          timer.current = setTimeout(() => setSaving(false), 900);
        }}
      />
      <Field.Description>
        {saving ? (
          <span className="inline-flex items-center gap-r6">
            <Spinner /> Saving…
          </span>
        ) : (
          "Saved when you let go."
        )}
      </Field.Description>
    </Field>
  );
}

function SettingsForm() {
  const [saved, setSaved] = useState("—");
  const form = useForm<{ refresh: number; volume: number }>({
    defaultValues: { refresh: 30, volume: 40 },
    onSubmit: (values) => setSaved(JSON.stringify(values)),
  });
  return (
    <Form form={form} className="grid content-start gap-r3" data-sc="slider-settings">
      <Field name="refresh">
        <Field.Label>Refresh every</Field.Label>
        <Slider min={5} max={120} step={5} formatValue={(s) => `${s} seconds`} marks={[5, 30, 60, 90, 120]} />
      </Field>
      <Field name="volume">
        <Field.Label>Alert sound volume</Field.Label>
        <Slider formatOptions={PERCENT} showValue />
      </Field>
      <FormActions>
        <FormActions.Submit>Save settings</FormActions.Submit>
      </FormActions>
      <output className="text-body-2 text-fg-secondary">Submitted: {saved}</output>
    </Form>
  );
}

export default function SliderSection() {
  return (
    <Stack>
      <Row label="Alert threshold: marks with labels, value bubble on drag or keyboard focus, saves once per gesture">
        <Grid>
          <Threshold />
          <SavingSetting />
        </Grid>
      </Row>
      <Row label="Settings form: bound through Field name, submitted with the form">
        <SettingsForm />
      </Row>
      <Row label="States: invalid · disabled · read-only · decimal step in de-DE · at its maximum">
        <Grid>
          <Field>
            <Field.Label>Sample rate</Field.Label>
            <Slider defaultValue={5} formatOptions={PERCENT} />
            <Field.Error>Below 10% the p99 is noise.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Burst limit</Field.Label>
            <Slider defaultValue={60} marks={[0, 25, 50, 75, 100]} />
          </Field>
          <Field readOnly>
            <Field.Label>Plan quota (read-only)</Field.Label>
            <Slider defaultValue={80} formatOptions={PERCENT} />
          </Field>
          <Field>
            <Field.Label>Gewichtung</Field.Label>
            <Slider locale="de-DE" min={0} max={1} step={0.05} defaultValue={0.35} showValue />
          </Field>
          <Field>
            <Field.Label>Replicas</Field.Label>
            <Slider min={1} max={12} defaultValue={12} marks={[1, 4, 8, 12]} />
          </Field>
        </Grid>
      </Row>
      <Row label="Long labels · compact · RTL (fills from the right; ArrowLeft increases) · vertical">
        <Grid>
          <Field>
            <Field.Label>Minimum time an incident must stay healthy before it resolves itself automatically</Field.Label>
            <Slider
              min={0}
              max={60}
              step={5}
              defaultValue={30}
              formatValue={(m) => `${m} minutes`}
              marks={[
                { value: 0, label: "Immediately" },
                { value: 60, label: "An hour" },
              ]}
            />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Compact</Field.Label>
              <Slider defaultValue={45} marks={[{ value: 0, label: "Off" }, 50, { value: 100, label: "Max" }]} showValue />
            </Field>
          </div>
          <div dir="rtl" data-sc="slider-rtl">
            <Field>
              <Field.Label>مستوى الصوت</Field.Label>
              <Slider locale="ar-EG" defaultValue={30} marks={[{ value: 0, label: "٠" }, { value: 100, label: "١٠٠" }]} showValue />
            </Field>
          </div>
          <div className="flex gap-r2">
            <Slider
              aria-label="Bass"
              orientation="vertical"
              min={-12}
              max={12}
              defaultValue={3}
              formatValue={(db) => `${db} dB`}
              marks={[
                { value: -12, label: "−12" },
                { value: 0, label: "0" },
                { value: 12, label: "+12" },
              ]}
              showValue
            />
            <Slider aria-label="Treble" orientation="vertical" min={-12} max={12} defaultValue={-4} formatValue={(db) => `${db} dB`} />
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
