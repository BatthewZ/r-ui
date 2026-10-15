import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../primitives";
import { Checkbox } from "./Checkbox";
import { ErrorSummary } from "./ErrorSummary";
import { Field, useField } from "./Field";
import { FormActions } from "./FormActions";
import { Input } from "./Input";
import { NumberInput } from "./NumberInput";
import { Radio, RadioGroup } from "./RadioGroup";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { Switch } from "./Switch";
import { Textarea } from "./Textarea";
import type { FieldValidator } from "./form-state-store";
import { defineSchema, deferred, issue } from "./form-state.test.schema";
import { Form, type FormApi, useFieldArray, useForm, useFormState, useFormValue, type UseFormOptions } from "./use-form";

interface Settings {
  name: string;
  notes: string;
  region: string;
  enabled: boolean;
  paging: boolean;
  severity: string;
  window: string;
  threshold: number | null;
}

const DEFAULTS: Settings = {
  name: "cpu-high",
  notes: "Restart the pool",
  region: "eu",
  enabled: false,
  paging: true,
  severity: "p2",
  window: "5m",
  threshold: 80,
};

function AllControls({ onSubmit }: { onSubmit: (values: Settings) => void }) {
  const form = useForm<Settings>({ defaultValues: DEFAULTS, onSubmit });
  return (
    <Form form={form}>
      <Field name="name">
        <Field.Label>Name</Field.Label>
        <Input />
      </Field>
      <Field name="notes">
        <Field.Label>Notes</Field.Label>
        <Textarea />
      </Field>
      <Field name="region">
        <Field.Label>Region</Field.Label>
        <Select>
          <option value="eu">Europe</option>
          <option value="us">United States</option>
        </Select>
      </Field>
      <Field name="enabled">
        <Checkbox>Enabled</Checkbox>
      </Field>
      <Field name="paging">
        <Switch>Page on-call</Switch>
      </Field>
      <Field name="severity">
        <Field.Label>Severity</Field.Label>
        <RadioGroup>
          <Radio value="p1">P1</Radio>
          <Radio value="p2">P2</Radio>
        </RadioGroup>
      </Field>
      <Field name="window">
        <Field.Label>Window</Field.Label>
        <SegmentedControl>
          <SegmentedControl.Item value="1m">1m</SegmentedControl.Item>
          <SegmentedControl.Item value="5m">5m</SegmentedControl.Item>
        </SegmentedControl>
      </Field>
      <Field name="threshold">
        <Field.Label>Threshold</Field.Label>
        <NumberInput />
      </Field>
      <FormActions>
        <FormActions.Submit>Save</FormActions.Submit>
      </FormActions>
    </Form>
  );
}

describe("useForm + Field: binding by name", () => {
  it("binds every form control without per-control wiring: shows the defaults, submits typed values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AllControls onSubmit={onSubmit} />);

    // The defaults reach every control.
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("cpu-high");
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("Restart the pool");
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveValue("eu");
    expect(screen.getByRole("checkbox", { name: "Enabled" })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Page on-call" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "P2" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "5m" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Threshold" })).toHaveValue("80");

    // And each control writes back.
    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "mem-high");
    await user.type(screen.getByRole("textbox", { name: "Notes" }), " now");
    await user.selectOptions(screen.getByRole("combobox", { name: "Region" }), "us");
    await user.click(screen.getByRole("checkbox", { name: "Enabled" }));
    await user.click(screen.getByRole("switch", { name: "Page on-call" }));
    await user.click(screen.getByRole("radio", { name: "P1" }));
    await user.click(screen.getByRole("radio", { name: "1m" }));
    const threshold = screen.getByRole("spinbutton", { name: "Threshold" });
    await user.clear(threshold);
    await user.type(threshold, "92.5{Enter}");

    // Enter in a field submitted the native form.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "mem-high",
      notes: "Restart the pool now",
      region: "us",
      enabled: true,
      paging: false,
      severity: "p1",
      window: "1m",
      threshold: 92.5,
    });
  });

  it("gives each bound control its path as the native name, for a form posted without script", () => {
    render(<AllControls onSubmit={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("name", "name");
    expect(screen.getByRole("checkbox", { name: "Enabled" })).toHaveAttribute("name", "enabled");
    expect(screen.getByRole("radio", { name: "P1" })).toHaveAttribute("name", "severity");
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveAttribute("name", "region");
  });

  it("leaves a control the caller controls alone", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    function Harness() {
      const form = useForm({ defaultValues: { name: "from-form" }, onSubmit });
      const [own, setOwn] = useState("mine");
      return (
        <Form form={form}>
          <Field name="name">
            <Field.Label>Name</Field.Label>
            <Input value={own} onChange={(e) => setOwn(e.target.value)} />
          </Field>
          <button type="submit">Save</button>
        </Form>
      );
    }
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveValue("mine");
    // Not the form's either for a native post: a composite that controls its
    // input (a date picker) submits through its own hidden input.
    expect(input).not.toHaveAttribute("name");
    await user.type(input, "!");
    expect(input).toHaveValue("mine!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "from-form" });
  });
});

interface Rule {
  name: string;
  email: string;
  threshold: string;
}

const ruleSchema = defineSchema<Rule, Omit<Rule, "threshold"> & { threshold: number }>(
  (value) => [
    ...(value.name.trim() ? [] : [issue("Enter a rule name", "name")]),
    ...(/^\S+@\S+\.\S+$/.test(value.email) ? [] : [issue("Enter an email like ops@example.com", "email")]),
    ...(value.threshold !== "" && Number.isFinite(Number(value.threshold)) ? [] : [issue("Enter a number", "threshold")]),
  ],
  (value) => ({ ...value, threshold: Number(value.threshold) }),
);

function RuleForm(props: {
  onSubmit?: UseFormOptions<Rule, Omit<Rule, "threshold"> & { threshold: number }>["onSubmit"];
  checkName?: (value: unknown, context: { signal: AbortSignal }) => Promise<string | undefined>;
  emailFirst?: boolean;
}) {
  const form = useForm({
    schema: ruleSchema,
    defaultValues: { name: "", email: "", threshold: "" },
    onSubmit: props.onSubmit,
  });
  const [showEmail, setShowEmail] = useState(!props.emailFirst);
  return (
    <Form form={form}>
      <ErrorSummary />
      {showEmail && props.emailFirst && <EmailField />}
      <Field name="name" required validate={props.checkName}>
        <Field.Label>Rule name</Field.Label>
        <Input />
        <Pending />
        <Field.Description>Shown in alert titles.</Field.Description>
        <Field.Error />
      </Field>
      {!props.emailFirst && <EmailField />}
      <Field name="threshold">
        <Field.Label>Threshold</Field.Label>
        <Input />
        <Field.Error />
      </Field>
      <button type="button" onClick={() => setShowEmail(true)}>
        Add email
      </button>
      <FormActions>
        <Button variant="secondary" type="reset">
          Reset
        </Button>
        <FormActions.Submit>Create rule</FormActions.Submit>
      </FormActions>
    </Form>
  );
}

function EmailField() {
  return (
    <Field name="email">
      <Field.Label>Email</Field.Label>
      <Input type="email" />
      <Field.Error />
    </Field>
  );
}

function Pending() {
  const validating = useField()?.binding?.validating;
  return validating ? <span>Checking availability…</span> : null;
}

describe("useForm: validation and errors", () => {
  it("shows a field's error on blur and clears it as the value is fixed", async () => {
    const user = userEvent.setup();
    render(<RuleForm />);
    const name = screen.getByRole("textbox", { name: "Rule name" });
    expect(name).not.toHaveAttribute("aria-invalid");
    await user.click(name);
    await user.tab();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Shown in alert titles. Enter a rule name");
    // The next field was never reached: it stays quiet.
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-invalid");

    await user.type(name, "C");
    expect(name).not.toHaveAttribute("aria-invalid");
    expect(name).toHaveAccessibleDescription("Shown in alert titles.");
  });

  it("on a failed submit focuses the first invalid field, described by its error, and lists every error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RuleForm onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: "Rule name" }), "CPU");
    await user.click(screen.getByRole("button", { name: "Create rule" }));

    const email = screen.getByRole("textbox", { name: "Email" });
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAccessibleDescription("Enter an email like ops@example.com");
    expect(onSubmit).not.toHaveBeenCalled();

    const summary = screen.getByRole("alert");
    const links = within(summary).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual([
      "Email: Enter an email like ops@example.com",
      "Threshold: Enter a number",
    ]);
    await user.click(links[1] as HTMLElement);
    expect(screen.getByRole("textbox", { name: "Threshold" })).toHaveFocus();

    // Fixing a field takes it off the list; fixing the last removes the summary.
    await user.type(screen.getByRole("textbox", { name: "Threshold" }), "90");
    expect(within(screen.getByRole("alert")).getAllByRole("link")).toHaveLength(1);
    await user.type(email, "ops@example.com");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("has the error in the field's description at the moment focus lands, not a render later", async () => {
    const user = userEvent.setup();
    let describedAtFocus: string | null = "not focused";
    function Harness() {
      const form = useForm({ schema: ruleSchema, defaultValues: { name: "", email: "", threshold: "" } });
      return (
        <Form form={form}>
          <Field name="name">
            <Field.Label>Rule name</Field.Label>
            <Input
              onFocus={(event) => {
                const ids = event.currentTarget.getAttribute("aria-describedby")?.split(" ") ?? [];
                describedAtFocus = ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
              }}
            />
            <Field.Error />
          </Field>
          <button type="submit">Save</button>
        </Form>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Rule name" })).toHaveFocus());
    expect(describedAtFocus).toBe("Enter a rule name");
  });

  it("orders 'first invalid' by the page, not by when a field mounted", async () => {
    const user = userEvent.setup();
    render(<RuleForm emailFirst />);
    // Email mounts last but renders above the name field.
    await user.click(screen.getByRole("button", { name: "Add email" }));
    await user.click(screen.getByRole("button", { name: "Create rule" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Email" })).toHaveFocus());
    expect(within(screen.getByRole("alert")).getAllByRole("link")[0]).toHaveTextContent(/^Email:/);
  });

  it("labels summary links without the required marker", async () => {
    const user = userEvent.setup();
    render(<RuleForm />);
    await user.click(screen.getByRole("button", { name: "Create rule" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Rule name" })).toHaveFocus());
    expect(within(screen.getByRole("alert")).getAllByRole("link")[0]).toHaveTextContent("Rule name: Enter a rule name");
  });

  it("shows an async check as pending, then its answer; submit waits for it", async () => {
    const user = userEvent.setup();
    const answers: Array<ReturnType<typeof deferred<string | undefined>>> = [];
    const checkName = vi.fn(() => {
      const answer = deferred<string | undefined>();
      answers.push(answer);
      return answer.promise;
    });
    const onSubmit = vi.fn();
    render(<RuleForm checkName={checkName} onSubmit={onSubmit} />);
    const name = screen.getByRole("textbox", { name: "Rule name" });
    await user.type(name, "cpu-high");
    await user.tab();
    expect(screen.getByText("Checking availability…")).toBeInTheDocument();
    await act(async () => answers.at(-1)?.resolve("That name is taken"));
    expect(screen.queryByText("Checking availability…")).toBeNull();
    expect(name).toHaveAccessibleDescription("Shown in alert titles. That name is taken");

    await user.type(screen.getByRole("textbox", { name: "Email" }), "ops@example.com");
    await user.type(screen.getByRole("textbox", { name: "Threshold" }), "90");
    await user.clear(name);
    await user.type(name, "cpu-high-2");
    const submit = screen.getByRole("button", { name: "Create rule" });
    await user.click(submit);
    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => answers.at(-1)?.resolve(undefined));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ name: "cpu-high-2", email: "ops@example.com", threshold: 90 });
  });

  it("shows server errors by path, focuses the field, and clears one when its value changes", async () => {
    const user = userEvent.setup();
    render(
      <RuleForm onSubmit={(_rule, { setErrors }) => setErrors({ email: "No account uses this address" })} />,
    );
    await user.type(screen.getByRole("textbox", { name: "Rule name" }), "CPU");
    const email = screen.getByRole("textbox", { name: "Email" });
    await user.type(email, "ghost@example.com");
    await user.type(screen.getByRole("textbox", { name: "Threshold" }), "1");
    await user.click(screen.getByRole("button", { name: "Create rule" }));
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAccessibleDescription("No account uses this address");
    expect(within(screen.getByRole("alert")).getByRole("link")).toHaveTextContent("Email: No account uses this address");
    await user.type(email, "x");
    expect(email).not.toHaveAttribute("aria-invalid");
  });

  it("keeps the submit button busy through an async onSubmit and ignores presses meanwhile", async () => {
    const user = userEvent.setup();
    const gate = deferred<void>();
    const onSubmit = vi.fn(() => gate.promise);
    render(<RuleForm onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: "Rule name" }), "CPU");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "a@b.co");
    await user.type(screen.getByRole("textbox", { name: "Threshold" }), "1");
    const submit = screen.getByRole("button", { name: "Create rule" });
    await user.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveAttribute("aria-busy", "true");
    await user.click(submit);
    await user.type(screen.getByRole("textbox", { name: "Threshold" }), "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve());
    expect(submit).not.toHaveAttribute("aria-busy");
  });

  it("resets values and errors from a native reset button", async () => {
    const user = userEvent.setup();
    render(<RuleForm />);
    const name = screen.getByRole("textbox", { name: "Rule name" });
    await user.click(screen.getByRole("button", { name: "Create rule" }));
    await waitFor(() => expect(name).toHaveFocus());
    await user.type(name, "draft");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(name).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Threshold" })).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

interface Condition {
  metric: string;
}
const conditionsSchema = defineSchema<{ conditions: Condition[] }>((value) => [
  ...(value.conditions.length ? [] : [issue("Add at least one condition", "conditions")]),
  ...value.conditions.flatMap((c, i) => (c.metric ? [] : [issue("Choose a metric", "conditions", i, "metric")])),
]);

function Conditions({
  defaultValues = { conditions: [{ metric: "cpu" }, { metric: "" }] },
  validate,
}: {
  defaultValues?: { conditions: Condition[] };
  validate?: FieldValidator;
}) {
  const form = useForm({ schema: conditionsSchema, defaultValues });
  return (
    <Form form={form}>
      <ConditionRows validate={validate} />
      <button type="submit">Save</button>
    </Form>
  );
}

function ConditionRows({ validate }: { validate?: FieldValidator | undefined }) {
  const { items, append, remove, move, error } = useFieldArray<Condition>("conditions");
  return (
    <>
      {items.map((item) => (
        <div key={item.key} data-testid="row">
          <Field name={`${item.name}.metric`} validate={validate}>
            <Field.Label>Metric {item.index + 1}</Field.Label>
            <Input />
            <Field.Error />
          </Field>
          <button type="button" onClick={() => move(item.index, item.index - 1)}>
            Up {item.index + 1}
          </button>
          <button type="button" onClick={() => remove(item.index)}>
            Remove {item.index + 1}
          </button>
        </div>
      ))}
      {error && <p>{error}</p>}
      <button type="button" onClick={() => append({ metric: "" })}>
        Add condition
      </button>
    </>
  );
}

describe("useFieldArray", () => {
  it("moves a row with its DOM, value and error; removes and appends rows", async () => {
    const user = userEvent.setup();
    render(<Conditions />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    const second = screen.getByRole("textbox", { name: "Metric 2" });
    await waitFor(() => expect(second).toHaveFocus());
    expect(second).toHaveAccessibleDescription("Choose a metric");

    await user.click(screen.getByRole("button", { name: "Up 2" }));
    // Same element (stable key), now first, still carrying its error.
    expect(screen.getByRole("textbox", { name: "Metric 1" })).toBe(second);
    expect(second).toHaveAccessibleDescription("Choose a metric");
    expect(screen.getByRole("textbox", { name: "Metric 2" })).toHaveValue("cpu");
    expect(screen.getByRole("textbox", { name: "Metric 2" })).not.toHaveAttribute("aria-invalid");

    await user.click(screen.getByRole("button", { name: "Remove 1" }));
    expect(screen.getAllByTestId("row")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Metric 1" })).toHaveValue("cpu");
    await user.click(screen.getByRole("button", { name: "Remove 1" }));
    expect(screen.getByText("Add at least one condition")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add condition" }));
    expect(screen.queryByText("Add at least one condition")).toBeNull();
    // After a submit every field is reportable: the new empty row says so.
    expect(screen.getByRole("textbox", { name: "Metric 1" })).toHaveAccessibleDescription("Choose a metric");
  });

  it("keeps a row's field-check error with it through a move and a removal", async () => {
    const user = userEvent.setup();
    render(
      <Conditions
        defaultValues={{ conditions: [{ metric: "cpu" }, { metric: "bogus" }, { metric: "disk" }] }}
        validate={(value) => (value === "bogus" ? "Unknown metric" : undefined)}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    const bogus = screen.getByRole("textbox", { name: "Metric 2" });
    await waitFor(() => expect(bogus).toHaveFocus());
    expect(bogus).toHaveAccessibleDescription("Unknown metric");

    await user.click(screen.getByRole("button", { name: "Up 2" }));
    expect(screen.getByRole("textbox", { name: "Metric 1" })).toBe(bogus);
    expect(bogus).toHaveAccessibleDescription("Unknown metric");
    expect(screen.getByRole("textbox", { name: "Metric 2" })).not.toHaveAttribute("aria-invalid");

    await user.click(screen.getByRole("button", { name: "Remove 2" }));
    expect(screen.getByRole("textbox", { name: "Metric 1" })).toBe(bogus);
    expect(bogus).toHaveAccessibleDescription("Unknown metric");
    expect(screen.getByRole("textbox", { name: "Metric 2" })).toHaveValue("disk");
  });
});

describe("form hooks outside the Form", () => {
  it("read state and values of a form passed explicitly (a page header beside the form)", async () => {
    const user = userEvent.setup();
    function Header({ form }: { form: FormApi<{ name: string }> }) {
      const { dirty } = useFormState(form);
      const name = useFormValue<string>("name", form);
      return <p>{dirty ? `Unsaved: ${name}` : "Saved"}</p>;
    }
    function Page() {
      const form = useForm({ defaultValues: { name: "cpu" } });
      return (
        <>
          <Header form={form} />
          <Form form={form}>
            <Field name="name">
              <Field.Label>Name</Field.Label>
              <Input />
            </Field>
          </Form>
        </>
      );
    }
    render(<Page />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "-high");
    expect(screen.getByText("Unsaved: cpu-high")).toBeInTheDocument();
  });
});
