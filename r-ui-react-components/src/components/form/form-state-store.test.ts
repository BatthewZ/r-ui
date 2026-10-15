import { describe, expect, it, vi } from "vitest";

import { canonicalPath, getIn, isWithin, issuePath, parsePath, setIn } from "./form-state-path";
import { FormStore, type FieldRegistration, type FieldValidator } from "./form-state-store";
import { defineSchema, deferred, issue } from "./form-state.test.schema";

const field = (validate?: FieldValidator): FieldRegistration => ({
  getElement: () => null,
  getLabel: () => undefined,
  validate,
});

// Lets every queued promise reaction run.
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("form paths", () => {
  it("reads a.b[0].c and a.b.0.c as the same path, spelled one way", () => {
    expect(parsePath("a.b[0].c")).toEqual(["a", "b", 0, "c"]);
    expect(parsePath("a.b.0.c")).toEqual(["a", "b", 0, "c"]);
    expect(canonicalPath("a.b.0.c")).toBe("a.b[0].c");
    expect(canonicalPath("[2].x")).toBe("[2].x");
  });

  it("turns a Standard Schema issue path (keys or { key } segments) into the same spelling", () => {
    expect(issuePath(["conditions", 1, "metric"])).toBe("conditions[1].metric");
    expect(issuePath([{ key: "conditions" }, { key: "1" }, { key: "metric" }])).toBe("conditions[1].metric");
    expect(issuePath(undefined)).toBe("");
  });

  it("writes a nested value, copying only the containers along the path", () => {
    const source = { a: { b: [{ c: 1 }, { c: 2 }] }, untouched: { x: 1 } };
    const next = setIn(source, "a.b[1].c", 9);
    expect(getIn(next, "a.b[1].c")).toBe(9);
    expect(source.a.b[1]?.c).toBe(2);
    expect(next.untouched).toBe(source.untouched);
    expect(next.a.b[0]).toBe(source.a.b[0]);
    // A missing branch is created with the container its next key implies.
    expect(setIn({}, "rows[0].name", "x")).toEqual({ rows: [{ name: "x" }] });
  });

  it("knows a path's descendants by segment, not by prefix", () => {
    expect(isWithin("tags[2]", "tags")).toBe(true);
    expect(isWithin("name.first", "name")).toBe(true);
    expect(isWithin("name2", "name")).toBe(false);
    expect(isWithin("name", "name")).toBe(true);
  });
});

interface Rule {
  name: string;
  threshold: string;
}

const ruleSchema = defineSchema<Rule, { name: string; threshold: number }>(
  (value) => [
    ...(value.name.trim() ? [] : [issue("Enter a name", "name")]),
    ...(Number.isFinite(Number(value.threshold)) && value.threshold !== "" ? [] : [issue("Enter a number", "threshold")]),
  ],
  (value) => ({ name: value.name.trim(), threshold: Number(value.threshold) }),
);

const newRuleStore = (options: Partial<ConstructorParameters<typeof FormStore<Rule, { name: string; threshold: number }>>[0]> = {}) =>
  new FormStore<Rule, { name: string; threshold: number }>({
    defaultValues: { name: "", threshold: "" },
    schema: ruleSchema,
    ...options,
  });

describe("FormStore: when errors show", () => {
  it("validates on blur first, then on every change, so an error clears as it is fixed", () => {
    const store = newRuleStore();
    store.registerField("name", field());
    store.change("name", "");
    store.change("name", " ");
    expect(store.getFieldSnapshot("name").error).toBeUndefined();

    store.blur("name");
    expect(store.getFieldSnapshot("name").error).toBe("Enter a name");
    expect(store.getFieldSnapshot("name").touched).toBe(true);
    // A field the user has not reached stays quiet.
    expect(store.getFieldSnapshot("threshold").error).toBeUndefined();

    store.change("name", "CPU high");
    expect(store.getFieldSnapshot("name").error).toBeUndefined();
  });

  it("follows validateOn / revalidateOn", () => {
    const store = newRuleStore({ validateOn: "change", revalidateOn: "submit" });
    store.change("name", " ");
    expect(store.getFieldSnapshot("name").error).toBe("Enter a name");
    // Re-checks wait for the submit now, so the stale message stays.
    store.change("name", "ok");
    expect(store.getFieldSnapshot("name").error).toBe("Enter a name");

    const quiet = newRuleStore({ validateOn: "submit" });
    quiet.blur("name");
    quiet.change("name", " ");
    expect(quiet.getFieldSnapshot("name").error).toBeUndefined();
  });

  it("shows an error deeper in a field's value on that field", () => {
    const schema = defineSchema<{ tags: string[] }>((value) =>
      value.tags.flatMap((tag, i) => (tag.length > 3 ? [issue("Too long", "tags", i)] : [])),
    );
    const store = new FormStore({ defaultValues: { tags: ["a"] }, schema });
    store.blur("tags");
    store.change("tags", ["a", "b", "longer"]);
    expect(store.getFieldSnapshot("tags").error).toBe("Too long");
  });
});

describe("FormStore: submit", () => {
  it("hands the schema's parsed output to onValid, once", async () => {
    const store = newRuleStore();
    store.change("name", "  CPU high ");
    store.change("threshold", "90");
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    expect(await store.submit(onValid, onInvalid)).toBe(true);
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid.mock.calls[0]?.[0]).toEqual({ name: "CPU high", threshold: 90 });
    expect(onInvalid).not.toHaveBeenCalled();
    expect(store.getFormSnapshot()).toMatchObject({ submitting: false, submitFailed: false, submitCount: 1, focusRequest: 0 });
  });

  it("stops on errors: every field shows its error, focus is requested, onInvalid gets them by path", async () => {
    const store = newRuleStore();
    store.registerField("name", field());
    store.registerField("threshold", field());
    const onValid = vi.fn();
    const onInvalid = vi.fn();
    expect(await store.submit(onValid, onInvalid)).toBe(false);
    expect(onValid).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledTimes(1);
    expect(onInvalid.mock.calls[0]?.[0]).toEqual({ name: "Enter a name", threshold: "Enter a number" });
    expect(store.getFieldSnapshot("threshold").error).toBe("Enter a number");
    expect(store.getFormSnapshot()).toMatchObject({ submitFailed: true, focusRequest: 1 });
  });

  it("ignores a second submit while one is running", async () => {
    const store = newRuleStore({ defaultValues: { name: "a", threshold: "1" } });
    const gate = deferred<void>();
    const onValid = vi.fn(() => gate.promise);
    const first = store.submit(onValid);
    await flush();
    expect(store.getFormSnapshot().submitting).toBe(true);
    expect(await store.submit(onValid)).toBe(false);
    gate.resolve();
    expect(await first).toBe(true);
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(store.getFormSnapshot().submitting).toBe(false);
  });
});

describe("FormStore: async validation", () => {
  it("drops an async schema result that a newer run overtook", async () => {
    const answers: Array<ReturnType<typeof deferred<{ message: string; path: string[] }[]>>> = [];
    const schema = defineSchema<{ name: string }>(() => {
      const answer = deferred<{ message: string; path: string[] }[]>();
      answers.push(answer);
      return answer.promise;
    });
    const store = new FormStore({ defaultValues: { name: "" }, schema, validateOn: "change" });
    store.change("name", "a"); // run 1
    store.change("name", "ab"); // run 2
    expect(store.getFormSnapshot().validating).toBe(true);
    answers[1]?.resolve([]);
    await flush();
    expect(store.getFormSnapshot().validating).toBe(false);
    // The older run answers last, with an error for the old value: ignored.
    answers[0]?.resolve([{ message: "Stale", path: ["name"] }]);
    await flush();
    expect(store.getFieldSnapshot("name").error).toBeUndefined();
  });

  it("runs a field check once the schema accepts, shows it pending, and aborts it for a newer value", async () => {
    const calls: Array<{ value: unknown; signal: AbortSignal; answer: ReturnType<typeof deferred<string | undefined>> }> = [];
    const taken: FieldValidator = (value, { signal }) => {
      const answer = deferred<string | undefined>();
      calls.push({ value, signal, answer });
      return answer.promise;
    };
    const store = newRuleStore();
    store.registerField("name", field(taken));

    store.blur("name"); // empty: the schema refuses it, so the server is not asked
    expect(calls).toHaveLength(0);
    expect(store.getFieldSnapshot("name").error).toBe("Enter a name");

    store.change("name", "cpu");
    expect(calls).toHaveLength(1);
    expect(store.getFieldSnapshot("name").validating).toBe(true);
    store.change("name", "cpu-high");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[1]?.signal.aborted).toBe(false);

    // The aborted check answering late changes nothing.
    calls[0]?.answer.resolve("That name is taken");
    await flush();
    expect(store.getFieldSnapshot("name").error).toBeUndefined();
    expect(store.getFieldSnapshot("name").validating).toBe(true);

    calls[1]?.answer.resolve("That name is taken");
    await flush();
    expect(store.getFieldSnapshot("name")).toMatchObject({ error: "That name is taken", validating: false });

    // Blurring with the same value does not ask again.
    store.blur("name");
    store.change("name", "cpu-high");
    expect(calls).toHaveLength(2);
  });

  it("waits for field checks on submit and fails on their answer", async () => {
    const store = newRuleStore({ defaultValues: { name: "cpu", threshold: "1" } });
    store.registerField("name", field(async () => "That name is taken"));
    const onValid = vi.fn();
    expect(await store.submit(onValid)).toBe(false);
    expect(onValid).not.toHaveBeenCalled();
    expect(store.getFieldSnapshot("name").error).toBe("That name is taken");
  });

  it("lets a submit go on when a field it waits for unmounts, even if its check ignores the signal", async () => {
    const store = newRuleStore({ defaultValues: { name: "cpu", threshold: "1" } });
    const unregister = store.registerField("name", field(() => new Promise(() => {})));
    const onValid = vi.fn();
    const submitting = store.submit(onValid);
    await flush();
    expect(store.getFormSnapshot().submitting).toBe(true);
    unregister();
    expect(await submitting).toBe(true);
    expect(onValid).toHaveBeenCalledTimes(1);
  });

  it("aborts the in-flight check of a field that unmounts, and forgets its answer", () => {
    let signal: AbortSignal | undefined;
    const store = newRuleStore({ defaultValues: { name: "cpu", threshold: "1" } });
    const unregister = store.registerField(
      "name",
      field((_value, context) => {
        signal = context.signal;
        return new Promise(() => {});
      }),
    );
    store.blur("name");
    expect(store.getFieldSnapshot("name").validating).toBe(true);
    unregister();
    expect(signal?.aborted).toBe(true);
    expect(store.getFieldSnapshot("name").validating).toBe(false);
  });
});

describe("FormStore: server errors", () => {
  it("shows a server error at once, clears it when that value changes, and fails a submit that set one", async () => {
    const store = newRuleStore({ defaultValues: { name: "cpu", threshold: "1" } });
    store.registerField("name", field());
    expect(
      await store.submit((_output, helpers) => helpers.setErrors({ name: "Already used by another rule", "": "Saved partially" })),
    ).toBe(false);
    expect(store.getFieldSnapshot("name").error).toBe("Already used by another rule");
    expect(store.getFormSnapshot()).toMatchObject({ submitFailed: true, focusRequest: 1 });
    expect(store.getErrorEntries().map((e) => [e.path, e.message])).toEqual([
      ["name", "Already used by another rule"],
      ["", "Saved partially"],
    ]);

    store.change("name", "cpu 2");
    expect(store.getFieldSnapshot("name").error).toBeUndefined();
    // The form-level message waits for the next submit.
    expect(store.getErrorEntries().map((e) => e.path)).toEqual([""]);
    expect(await store.submit()).toBe(true);
    expect(store.getErrorEntries()).toEqual([]);
  });

  it("sets errors by any path spelling and clears one with an empty message", () => {
    const store = newRuleStore();
    store.setErrors({ "conditions.0.metric": "Unknown metric" });
    expect(store.getFieldSnapshot("conditions[0].metric").error).toBe("Unknown metric");
    store.setErrors({ "conditions[0].metric": undefined });
    expect(store.getFieldSnapshot("conditions[0].metric").error).toBeUndefined();
  });
});

interface Condition {
  metric: string;
}
const conditionsSchema = defineSchema<{ conditions: Condition[] }>((value) => [
  ...(value.conditions.length ? [] : [issue("Add at least one condition", "conditions")]),
  ...value.conditions.flatMap((c, i) => (c.metric ? [] : [issue("Choose a metric", "conditions", i, "metric")])),
]);

describe("FormStore: field arrays", () => {
  const rows = (store: FormStore<{ conditions: Condition[] }>) => store.getValues().conditions.map((c) => c.metric);

  it("keeps each row's key through moves and removals; a new row gets a new key", () => {
    const store = new FormStore({ defaultValues: { conditions: [{ metric: "cpu" }, { metric: "mem" }, { metric: "disk" }] } });
    const [cpu, mem, disk] = store.getArraySnapshot("conditions").keys;
    store.move("conditions", 2, 0);
    expect(rows(store)).toEqual(["disk", "cpu", "mem"]);
    expect(store.getArraySnapshot("conditions").keys).toEqual([disk, cpu, mem]);
    store.remove("conditions", 1);
    expect(store.getArraySnapshot("conditions").keys).toEqual([disk, mem]);
    store.append("conditions", { metric: "net" });
    const keys = store.getArraySnapshot("conditions").keys;
    expect(keys.slice(0, 2)).toEqual([disk, mem]);
    expect(new Set([cpu, mem, disk]).has(keys[2] as number)).toBe(false);
    store.insert("conditions", 0, { metric: "io" });
    expect(rows(store)).toEqual(["io", "disk", "mem", "net"]);
    store.replace("conditions", [{ metric: "x" }]);
    expect(store.getArraySnapshot("conditions").keys).toHaveLength(1);
    expect(store.getArraySnapshot("conditions").keys[0]).not.toBe(disk);
  });

  it("moves a row's error and touched state with it, and drops them with a removed row", () => {
    const store = new FormStore({
      defaultValues: { conditions: [{ metric: "cpu" }, { metric: "" }, { metric: "disk" }] },
      schema: conditionsSchema,
    });
    store.blur("conditions[1].metric");
    store.setErrors({ "conditions[2].metric": "Not collected on this host" });
    expect(store.getFieldSnapshot("conditions[1].metric").error).toBe("Choose a metric");

    store.move("conditions", 1, 0);
    expect(store.getFieldSnapshot("conditions[0].metric")).toMatchObject({ error: "Choose a metric", touched: true });
    expect(store.getFieldSnapshot("conditions[1].metric")).toMatchObject({ error: undefined, touched: false });
    expect(store.getFieldSnapshot("conditions[2].metric").error).toBe("Not collected on this host");

    store.remove("conditions", 2);
    expect(store.getErrorEntries().some((e) => e.message === "Not collected on this host")).toBe(false);
    expect(store.getFieldSnapshot("conditions[0].metric").error).toBe("Choose a metric");
  });

  it("reports an error about the list itself once the list was edited", () => {
    const store = new FormStore({ defaultValues: { conditions: [{ metric: "cpu" }] }, schema: conditionsSchema });
    expect(store.getArraySnapshot("conditions").error).toBeUndefined();
    store.remove("conditions", 0);
    expect(store.getArraySnapshot("conditions").error).toBe("Add at least one condition");
    store.append("conditions", { metric: "cpu" });
    expect(store.getArraySnapshot("conditions").error).toBeUndefined();
  });

  it("ignores an out-of-range move or removal", () => {
    const store = new FormStore({ defaultValues: { conditions: [{ metric: "cpu" }] } });
    const before = store.getArraySnapshot("conditions");
    store.move("conditions", 0, 3);
    store.remove("conditions", 5);
    expect(rows(store)).toEqual(["cpu"]);
    expect(store.getArraySnapshot("conditions")).toBe(before);
  });
});

describe("FormStore: dirty and reset", () => {
  it("tracks dirty per field and for the form, by value not by identity", () => {
    const store = newRuleStore();
    store.change("name", "x");
    expect(store.getFieldSnapshot("name").dirty).toBe(true);
    expect(store.getFieldSnapshot("threshold").dirty).toBe(false);
    expect(store.getFormSnapshot().dirty).toBe(true);
    store.change("name", "");
    expect(store.getFormSnapshot().dirty).toBe(false);
  });

  it("resets values, errors and checks; reset(values) also moves the defaults", async () => {
    let signal: AbortSignal | undefined;
    const store = newRuleStore();
    store.registerField(
      "name",
      field((_value, context) => {
        signal = context.signal;
        return new Promise(() => {});
      }),
    );
    store.change("name", "cpu");
    store.blur("name");
    expect(store.getFieldSnapshot("name").validating).toBe(true);
    const onValid = vi.fn();
    const submitting = store.submit(onValid);

    store.reset();
    expect(signal?.aborted).toBe(true);
    // The submit waiting on the aborted check ends, and never reaches onValid.
    expect(await submitting).toBe(false);
    expect(onValid).not.toHaveBeenCalled();
    expect(store.getValues()).toEqual({ name: "", threshold: "" });
    expect(store.getFieldSnapshot("name")).toMatchObject({ error: undefined, touched: false, validating: false });
    expect(store.getFormSnapshot()).toMatchObject({ submitCount: 0, submitFailed: false, dirty: false });

    store.reset({ name: "saved", threshold: "5" });
    expect(store.getValues().name).toBe("saved");
    expect(store.getFormSnapshot().dirty).toBe(false);
  });
});

describe("FormStore: error entries", () => {
  it("lists one entry per mounted field, then errors no mounted field covers", async () => {
    const store = new FormStore({
      defaultValues: { conditions: [{ metric: "" }] as Condition[], name: "" },
      schema: defineSchema<{ conditions: Condition[]; name: string }>((value) => [
        ...(value.name ? [] : [issue("Enter a name", "name")]),
        ...value.conditions.flatMap((c, i) => (c.metric ? [] : [issue("Choose a metric", "conditions", i, "metric")])),
      ]),
    });
    store.registerField("name", field());
    await store.submit();
    expect(store.getErrorEntries().map((e) => [e.path, Boolean(e.field)])).toEqual([
      ["name", true],
      ["conditions[0].metric", false],
    ]);
  });

  it("returns the same snapshot objects while nothing changed (no render loop)", () => {
    const store = newRuleStore();
    expect(store.getFieldSnapshot("name")).toBe(store.getFieldSnapshot("name"));
    expect(store.getFormSnapshot()).toBe(store.getFormSnapshot());
    expect(store.getErrorEntries()).toBe(store.getErrorEntries());
    expect(store.getArraySnapshot("rows")).toBe(store.getArraySnapshot("rows"));
  });
});
