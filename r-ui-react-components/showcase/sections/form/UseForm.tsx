import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Checkbox,
  ErrorSummary,
  Field,
  Form,
  FormActions,
  Input,
  MultiSelect,
  NumberInput,
  Radio,
  RadioGroup,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  useField,
  useFieldArray,
  useForm,
  useFormValue,
} from "../../../src/components/form";
import { Alert, Button, Card, IconButton, Spinner } from "../../../src/components/primitives";
import {
  type AlertRule,
  alertRuleSchema,
  CHANNELS,
  checkNameFree,
  type ConditionInput,
  DEFAULT_RULE,
  EMPTY_CONDITION,
  METRICS,
  metricOf,
  saveRule,
  type ServerMode,
  SERVICES,
} from "./parts/alert-rule";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "useForm",
  group: "form",
  order: 150,
  description:
    "A settings form on useForm: Fields bind by name (no per-control wiring), a Standard Schema validates on blur and then as you type, the name is checked against the server (cancellable, shown pending), conditions are a field array, and the server can reject a field by path. Submit it empty: focus lands on the first invalid field and the summary links to every error. The second copy is the same form at compact density.",
};

/** The name field's control: a spinner while the server check runs. */
function NameInput() {
  const validating = useField()?.binding?.validating;
  return (
    <Input
      autoComplete="off"
      spellCheck={false}
      end={validating ? <Spinner label="Checking whether the name is free" className="text-fg-muted" /> : null}
    />
  );
}

function NameHint() {
  const validating = useField()?.binding?.validating;
  return (
    <Field.Description>
      {validating ? "Checking availability…" : "Lowercase letters, digits and hyphens. Shown in alert titles."}
    </Field.Description>
  );
}

function ThresholdUnit({ row }: { row: string }) {
  const metric = metricOf(useFormValue<string>(`${row}.metric`));
  return metric ? <span className="text-body-2">{metric.unit}</span> : null;
}

function Conditions() {
  const { items, append, remove, move, error } = useFieldArray<ConditionInput>("conditions");
  const listRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // A moved row's DOM is re-inserted, which can drop focus: put it back on the same control.
  const [refocus, setRefocus] = useState<string | null>(null);
  useEffect(() => {
    if (!refocus) return;
    listRef.current?.querySelector<HTMLElement>(refocus)?.focus();
    setRefocus(null);
  }, [refocus, items]);

  return (
    <fieldset className="grid min-w-0 gap-r4">
      <legend className="mb-r4 text-h5">Conditions</legend>
      <p className="text-body-2 text-fg-muted">The rule fires when every condition holds.</p>
      <div ref={listRef} className="grid gap-r4">
        {items.map((item) => {
          const n = item.index + 1;
          const last = item.index === items.length - 1;
          return (
            <div
              key={item.key}
              role="group"
              aria-label={`Condition ${n}`}
              data-row={item.key}
              className="@container rounded-md border p-r3"
            >
              <div className="grid gap-r4 @lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_auto] @lg:items-start">
                <Field name={`${item.name}.metric`}>
                  <Field.Label>
                    Metric<span className="sr-only"> (condition {n})</span>
                  </Field.Label>
                  <Select placeholder="Choose…">
                    {METRICS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  <Field.Error />
                </Field>
                <Field name={`${item.name}.operator`}>
                  <Field.Label>
                    Is<span className="sr-only"> (condition {n})</span>
                  </Field.Label>
                  <Select>
                    <option value="above">above</option>
                    <option value="below">below</option>
                  </Select>
                </Field>
                <Field name={`${item.name}.threshold`}>
                  <Field.Label>
                    Threshold<span className="sr-only"> (condition {n})</span>
                  </Field.Label>
                  <NumberInput min={0} end={<ThresholdUnit row={item.name} />} />
                  <Field.Error />
                </Field>
                <div className="flex gap-r6 @lg:mt-[calc(var(--BodyText-1-line-height)+var(--R-SIZE-5))]">
                  <IconButton
                    label={`Move condition ${n} up`}
                    icon={<ArrowUp />}
                    data-action="up"
                    disabled={item.index === 0}
                    onClick={() => {
                      move(item.index, item.index - 1);
                      setRefocus(`[data-row="${item.key}"] [data-action="up"]:not(:disabled), [data-row="${item.key}"] [data-action="down"]`);
                    }}
                  />
                  <IconButton
                    label={`Move condition ${n} down`}
                    icon={<ArrowDown />}
                    data-action="down"
                    disabled={last}
                    onClick={() => {
                      move(item.index, item.index + 1);
                      setRefocus(`[data-row="${item.key}"] [data-action="down"]:not(:disabled), [data-row="${item.key}"] [data-action="up"]`);
                    }}
                  />
                  <IconButton
                    label={`Remove condition ${n}`}
                    icon={<Trash2 />}
                    onClick={() => {
                      remove(item.index);
                      addRef.current?.focus();
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <Alert tone="error" role="note" labels={{ tones: { error: "" } }}>
          {error}
        </Alert>
      )}
      <div>
        <Button ref={addRef} variant="secondary" iconStart={<Plus />} onClick={() => append(EMPTY_CONDITION)}>
          Add condition
        </Button>
      </div>
    </fieldset>
  );
}

function AlertRuleForm({ server, idPrefix }: { server: ServerMode; idPrefix: string }) {
  const [saved, setSaved] = useState<AlertRule | null>(null);
  const form = useForm({
    schema: alertRuleSchema,
    defaultValues: DEFAULT_RULE,
    onSubmit: async (rule, { setErrors }) => {
      setSaved(null);
      const errors = await saveRule(rule, server);
      if (errors) setErrors(errors);
      else setSaved(rule);
    },
  });

  return (
    <Card data-sc={`${idPrefix}-form`}>
      <Card.Header>
        <Card.Title>Create alert rule</Card.Title>
        <Card.Description>Pages on-call when every condition holds for the pending period.</Card.Description>
      </Card.Header>
      <Card.Body>
        <Form form={form} className="grid gap-r2" aria-label="Create alert rule">
          <ErrorSummary />
          {saved && (
            <Alert
              tone="success"
              title={`Created “${saved.name}”`}
              actions={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSaved(null);
                    form.reset();
                  }}
                >
                  Create another
                </Button>
              }
            >
              {saved.conditions.length} condition{saved.conditions.length === 1 ? "" : "s"} on {saved.service}, checked
              every {saved.window}, held for {saved.forMinutes} min.
            </Alert>
          )}

          <div className="@container">
            <div className="grid gap-r3 @xl:grid-cols-2">
              <Field name="name" required validate={checkNameFree}>
                <Field.Label>Rule name</Field.Label>
                <NameInput />
                <NameHint />
                <Field.Error />
              </Field>
              <Field name="service" required>
                <Field.Label>Service</Field.Label>
                <Select placeholder="Choose a service…">
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <Field.Error />
              </Field>
              <Field name="severity">
                <Field.Label>Severity</Field.Label>
                <RadioGroup orientation="horizontal">
                  <Radio value="p1">P1 · customer-facing</Radio>
                  <Radio value="p2">P2 · degraded</Radio>
                  <Radio value="p3">P3 · watch</Radio>
                </RadioGroup>
              </Field>
              <Field name="window">
                <Field.Label>Evaluate every</Field.Label>
                <SegmentedControl>
                  <SegmentedControl.Item value="1m">1 min</SegmentedControl.Item>
                  <SegmentedControl.Item value="5m">5 min</SegmentedControl.Item>
                  <SegmentedControl.Item value="15m">15 min</SegmentedControl.Item>
                </SegmentedControl>
              </Field>
            </div>
          </div>

          <Conditions />

          <div className="@container">
            <div className="grid gap-r3 @xl:grid-cols-2">
              <Field name="forMinutes">
                <Field.Label>Pending period</Field.Label>
                <NumberInput min={0} max={1440} end="min" />
                <Field.Description>How long the conditions must hold before it fires.</Field.Description>
                <Field.Error />
              </Field>
              <div className="grid content-start gap-r4">
                <Field name="page">
                  <Switch>Page on-call when it fires</Switch>
                </Field>
                <Field name="muteWeekends">
                  <Checkbox>Mute on weekends</Checkbox>
                </Field>
              </div>
            </div>
          </div>

          <Field name="notify">
            <Field.Label>Also notify</Field.Label>
            <MultiSelect options={CHANNELS} />
            <Field.Description>Told when it fires, paged or not.</Field.Description>
          </Field>

          <Field name="runbook">
            <Field.Label>Runbook note</Field.Label>
            <Textarea rows={3} autosize maxRows={8} placeholder="What should whoever gets paged do first?" />
            <Field.Description>Required when the rule pages someone.</Field.Description>
            <Field.Error />
          </Field>

          <FormActions sticky className="-mx-r2 px-r2">
            <Button variant="secondary" type="reset">
              Reset
            </Button>
            <FormActions.Submit>Create rule</FormActions.Submit>
          </FormActions>
        </Form>
      </Card.Body>
    </Card>
  );
}

export default function UseFormSection() {
  const [server, setServer] = useState<ServerMode>("saves");
  return (
    <Stack>
      <Row label="The pretend rule service">
        <RadioGroup
          aria-label="When the form is valid, the server"
          orientation="horizontal"
          value={server}
          onValueChange={(v) => setServer(v as ServerMode)}
          data-sc="form-state-server"
        >
          <Radio value="saves">Saves it</Radio>
          <Radio value="rejects">Rejects a threshold</Radio>
          <Radio value="down">Is unavailable</Radio>
        </RadioGroup>
      </Row>
      <Row label="Comfortable · try “cpu-high” as the name (taken), or submit it empty">
        <AlertRuleForm server={server} idPrefix="form-state" />
      </Row>
      <Row label="The same form at compact density">
        <div data-density="compact">
          <AlertRuleForm server={server} idPrefix="form-state-compact" />
        </div>
      </Row>
    </Stack>
  );
}
