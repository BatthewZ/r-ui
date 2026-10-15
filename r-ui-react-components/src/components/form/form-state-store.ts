// The form's state, outside React: values, errors, touched, pending checks and
// field arrays, validated through a Standard Schema plus optional per-field
// (async) validators. React binds through `subscribe` + the cached snapshots
// (`useSyncExternalStore`); nothing here imports React.

import { canonicalPath, deepEqual, getIn, isWithin, issuePath, remapRowKey, setIn } from "./form-state-path";
import type { StandardSchemaResult, StandardSchemaV1 } from "./form-state-schema";

/** When a field is first checked, and when a field already showing a result is re-checked. */
export type ValidationTrigger = "change" | "blur" | "submit";

/** A message, or nothing (`undefined`, `null`, `""`) for a valid value. */
export type FieldValidatorResult = string | null | undefined;

export interface FieldValidatorContext {
  /** Aborted when a newer check of the same field starts, or the field goes away. */
  signal: AbortSignal;
  /** Every value in the form, for checks that compare fields. */
  values: unknown;
}

/** A per-field check, typically async ("is this name taken?"). Runs once the schema accepts the field. */
export type FieldValidator = (
  value: unknown,
  context: FieldValidatorContext,
) => FieldValidatorResult | Promise<FieldValidatorResult>;

/** What a mounted `Field` tells the store about itself. */
export interface FieldRegistration {
  /** The element focus goes to: the control, or the checked radio of a group. */
  getElement: () => HTMLElement | null;
  /** The field's visible label, for the error summary. */
  getLabel: () => string | undefined;
  validate?: FieldValidator | undefined;
}

export interface FieldStateSnapshot {
  value: unknown;
  /** The message to show, once the field may show one (see `validateOn`). */
  error: string | undefined;
  touched: boolean;
  dirty: boolean;
  /** An async check of this field is in flight. */
  validating: boolean;
}

export interface FormStateSnapshot {
  submitting: boolean;
  submitCount: number;
  /** The last submit stopped on errors (the schema's, a field check's or the server's). */
  submitFailed: boolean;
  dirty: boolean;
  /** An async schema run or field check is in flight. */
  validating: boolean;
  /** Bumped on every failed submit: the cue to move focus to the first invalid field. */
  focusRequest: number;
}

export interface FieldArraySnapshot {
  /** One stable key per row, surviving moves and removals around it. */
  keys: readonly number[];
  /** An error about the list itself ("Add at least one condition"). */
  error: string | undefined;
}

export interface FormErrorEntry {
  path: string;
  message: string;
  /** The mounted Field the error belongs to; absent for a form-level or unrendered path. */
  field: FieldRegistration | undefined;
}

export interface FormSubmitHelpers<TValues> {
  /** Errors from the server, by path (`""` for the form as a whole). A falsy message clears one. */
  setErrors: (errors: Record<string, FieldValidatorResult>) => void;
  reset: (values?: TValues) => void;
}

export interface FormStoreOptions<TValues, TOutput> {
  defaultValues: TValues;
  schema?: StandardSchemaV1<TValues, TOutput> | undefined;
  validateOn?: ValidationTrigger | undefined;
  revalidateOn?: ValidationTrigger | undefined;
}

interface PendingCheck {
  controller: AbortController;
  value: unknown;
  promise: Promise<void>;
}

const ABORTED = Symbol("aborted");

const isPromiseLike = <T>(value: unknown): value is PromiseLike<T> =>
  value !== null && (typeof value === "object" || typeof value === "function") && typeof (value as PromiseLike<T>).then === "function";

const report = (error: unknown) => {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else console.error(error);
};

function firstWithin(map: ReadonlyMap<string, string>, path: string, descendants: boolean): string | undefined {
  const exact = map.get(path);
  if (exact !== undefined || !descendants) return exact;
  for (const [key, message] of map) if (isWithin(key, path)) return message;
  return undefined;
}

/** `map` with every key under the array at `path` moved to its row's new index; rows that are gone drop out. */
function remapRows<V>(map: ReadonlyMap<string, V>, path: string, moved: ReadonlyMap<number, number>): Map<string, V> {
  const out = new Map<string, V>();
  const shifted: Array<[string, V]> = [];
  for (const [key, value] of map) {
    const to = remapRowKey(key, path, moved);
    if (to === key) out.set(key, value);
    else if (to !== null) shifted.push([to, value]);
  }
  // Last, so a moved row always beats a stale key already sitting at its new index.
  for (const [key, value] of shifted) out.set(key, value);
  return out;
}

const remapRowSet = (set: ReadonlySet<string>, path: string, moved: ReadonlyMap<number, number>) =>
  new Set(remapRows(new Map([...set].map((key) => [key, true])), path, moved).keys());

const sameKeys = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((key, i) => key === b[i]);

export class FormStore<TValues, TOutput = TValues> {
  private values: TValues;
  private defaults: TValues;
  private schema: StandardSchemaV1<TValues, TOutput> | undefined;
  private validateOn: ValidationTrigger;
  private revalidateOn: ValidationTrigger;

  // Messages by canonical path; the first one per path is kept.
  private schemaErrors = new Map<string, string>();
  private fieldErrors = new Map<string, string>();
  private serverErrors = new Map<string, string>();
  /** Fields that may show their errors before any submit (checked once already). */
  private reportable = new Set<string>();
  private touched = new Set<string>();
  /** The value each field check last answered for, so an unchanged value is not re-asked. */
  private checked = new Map<string, unknown>();
  private pending = new Map<string, PendingCheck>();

  private schemaRun = 0;
  private schemaPending = false;
  private output: TOutput | undefined;

  private submitting = false;
  /** Bumped by `reset`: a submit that started before it must not go on to `onValid`. */
  private generation = 0;
  private submitCount = 0;
  private submitFailed = false;
  private focusRequest = 0;

  private fields = new Map<string, FieldRegistration>();
  private summary: HTMLElement | null = null;
  private arrayKeys = new Map<string, readonly number[]>();
  private nextKey = 1;

  private listeners = new Set<() => void>();
  private version = 0;
  private fieldCache = new Map<string, FieldStateSnapshot>();
  private arrayCache = new Map<string, FieldArraySnapshot>();
  private formCache: FormStateSnapshot | undefined;
  private entriesCache: { version: number; entries: FormErrorEntry[] } | undefined;

  constructor(options: FormStoreOptions<TValues, TOutput>) {
    this.values = options.defaultValues;
    this.defaults = options.defaultValues;
    this.schema = options.schema;
    this.validateOn = options.validateOn ?? "blur";
    this.revalidateOn = options.revalidateOn ?? "change";
  }

  /** Updates the options a re-render may change. The values are untouched. */
  configure(options: Omit<FormStoreOptions<TValues, TOutput>, "defaultValues">): void {
    this.schema = options.schema;
    this.validateOn = options.validateOn ?? "blur";
    this.revalidateOn = options.revalidateOn ?? "change";
  }

  // ── subscription ────────────────────────────────────────────────────────

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(): void {
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }

  // ── reads ───────────────────────────────────────────────────────────────

  getValues = (): TValues => this.values;
  getValue = (path: string): unknown => getIn(this.values, canonicalPath(path));

  private isReportable(path: string): boolean {
    return this.submitCount > 0 || this.reportable.has(path);
  }

  /**
   * The message to show at `path`. A server error always shows; the schema's
   * and a field check's only once the field is reportable, so nothing is
   * flagged before the user has reached it. With `descendants`, an error deeper
   * in the value counts (a tag list shows its third tag's error).
   */
  private errorAt(path: string, descendants: boolean): string | undefined {
    const server = firstWithin(this.serverErrors, path, descendants);
    if (server !== undefined) return server;
    if (!this.isReportable(path)) return undefined;
    return firstWithin(this.fieldErrors, path, descendants) ?? firstWithin(this.schemaErrors, path, descendants);
  }

  getFieldSnapshot = (path: string): FieldStateSnapshot => {
    const value = getIn(this.values, path);
    const next: FieldStateSnapshot = {
      value,
      error: this.errorAt(path, true),
      touched: this.touched.has(path),
      dirty: !deepEqual(value, getIn(this.defaults, path)),
      validating: this.pending.has(path),
    };
    const prev = this.fieldCache.get(path);
    if (
      prev &&
      Object.is(prev.value, next.value) &&
      prev.error === next.error &&
      prev.touched === next.touched &&
      prev.dirty === next.dirty &&
      prev.validating === next.validating
    ) {
      return prev;
    }
    this.fieldCache.set(path, next);
    return next;
  };

  getFormSnapshot = (): FormStateSnapshot => {
    const next: FormStateSnapshot = {
      submitting: this.submitting,
      submitCount: this.submitCount,
      submitFailed: this.submitFailed,
      dirty: !deepEqual(this.values, this.defaults),
      validating: this.schemaPending || this.pending.size > 0,
      focusRequest: this.focusRequest,
    };
    const prev = this.formCache;
    if (prev && (Object.keys(next) as Array<keyof FormStateSnapshot>).every((key) => prev[key] === next[key])) return prev;
    this.formCache = next;
    return next;
  };

  private rowKeys(path: string): readonly number[] {
    const rows = getIn(this.values, path);
    const length = Array.isArray(rows) ? rows.length : 0;
    const known = this.arrayKeys.get(path) ?? [];
    if (known.length === length) return known;
    const keys = known.slice(0, length);
    while (keys.length < length) keys.push(this.nextKey++);
    this.arrayKeys.set(path, keys);
    return keys;
  }

  getArraySnapshot = (path: string): FieldArraySnapshot => {
    const next: FieldArraySnapshot = { keys: this.rowKeys(path), error: this.errorAt(path, false) };
    const prev = this.arrayCache.get(path);
    if (prev && prev.error === next.error && sameKeys(prev.keys, next.keys)) return prev;
    this.arrayCache.set(path, next);
    return next;
  };

  /**
   * Every error on show: one per mounted Field (its first message), then any
   * the schema or server reported for a path no mounted Field covers.
   */
  getErrorEntries = (): FormErrorEntry[] => {
    if (this.entriesCache?.version === this.version) return this.entriesCache.entries;
    const entries: FormErrorEntry[] = [];
    for (const [path, field] of this.fields) {
      const message = this.errorAt(path, true);
      if (message !== undefined) entries.push({ path, message, field });
    }
    const covered = (key: string) => [...this.fields.keys()].some((path) => isWithin(key, path));
    const loose = new Map<string, string>();
    for (const [map, alwaysShown] of [
      [this.serverErrors, true],
      [this.fieldErrors, false],
      [this.schemaErrors, false],
    ] as const) {
      for (const [key, message] of map) {
        if (!loose.has(key) && !covered(key) && (alwaysShown || this.isReportable(key))) loose.set(key, message);
      }
    }
    for (const [path, message] of loose) entries.push({ path, message, field: undefined });
    const prev = this.entriesCache?.entries;
    const same =
      prev?.length === entries.length &&
      entries.every((e, i) => prev[i]?.path === e.path && prev[i]?.message === e.message && prev[i]?.field === e.field);
    this.entriesCache = { version: this.version, entries: same && prev ? prev : entries };
    return this.entriesCache.entries;
  };

  // ── registration ────────────────────────────────────────────────────────

  registerField = (rawPath: string, registration: FieldRegistration): (() => void) => {
    const path = canonicalPath(rawPath);
    this.fields.set(path, registration);
    this.emit();
    return () => {
      if (this.fields.get(path) !== registration) return;
      this.fields.delete(path);
      // A check for a field that is gone can no longer be shown or answered.
      this.pending.get(path)?.controller.abort();
      this.pending.delete(path);
      this.fieldErrors.delete(path);
      this.checked.delete(path);
      this.emit();
    };
  };

  registerSummary = (element: HTMLElement | null): void => {
    this.summary = element;
  };

  // ── writes ──────────────────────────────────────────────────────────────

  /** A new value from a control (or the caller). Re-checks per `validateOn` / `revalidateOn`. */
  change = (rawPath: string, value: unknown): void => {
    const path = canonicalPath(rawPath);
    if (deepEqual(getIn(this.values, path), value)) return;
    this.values = setIn(this.values, path, value);
    // The server judged the old value.
    for (const key of [...this.serverErrors.keys()]) if (isWithin(key, path)) this.serverErrors.delete(key);
    // A check of the old value is moot.
    this.pending.get(path)?.controller.abort();
    this.pending.delete(path);
    const wasReportable = this.isReportable(path);
    if (!wasReportable && this.validateOn === "change") this.reportable.add(path);
    if (wasReportable ? this.revalidateOn === "change" : this.validateOn === "change") {
      this.settle(this.validatePath(path));
    }
    this.emit();
  };

  /** Focus left the field: it is touched, and checked per `validateOn` / `revalidateOn`. */
  blur = (rawPath: string): void => {
    const path = canonicalPath(rawPath);
    this.touched.add(path);
    const wasReportable = this.isReportable(path);
    if (!wasReportable && this.validateOn === "blur") this.reportable.add(path);
    if (wasReportable ? this.revalidateOn === "blur" : this.validateOn === "blur") {
      this.settle(this.validatePath(path));
    }
    this.emit();
  };

  setErrors = (errors: Record<string, FieldValidatorResult>): void => {
    for (const [rawPath, message] of Object.entries(errors)) {
      const path = canonicalPath(rawPath);
      if (message) this.serverErrors.set(path, message);
      else this.serverErrors.delete(path);
    }
    this.emit();
  };

  reset = (values?: TValues): void => {
    for (const check of this.pending.values()) check.controller.abort();
    if (values !== undefined) this.defaults = values;
    this.values = this.defaults;
    this.pending = new Map();
    this.schemaErrors = new Map();
    this.fieldErrors = new Map();
    this.serverErrors = new Map();
    this.reportable = new Set();
    this.touched = new Set();
    this.checked = new Map();
    this.arrayKeys = new Map();
    this.schemaRun += 1; // an in-flight schema run answers for the old values
    this.schemaPending = false;
    this.output = undefined;
    this.submitCount = 0;
    this.submitFailed = false;
    this.generation += 1;
    this.emit();
  };

  // ── validation ──────────────────────────────────────────────────────────

  private settle(work: Promise<unknown>): void {
    work.catch(report);
  }

  private applySchema(result: StandardSchemaResult<TOutput>): void {
    const errors = new Map<string, string>();
    if (result.issues) {
      for (const issue of result.issues) {
        const path = issuePath(issue.path);
        if (!errors.has(path)) errors.set(path, issue.message);
      }
      this.output = undefined;
    } else {
      this.output = result.value;
    }
    this.schemaErrors = errors;
  }

  /**
   * Validates every value through the schema. Synchronous for a synchronous
   * schema, so its errors land in the same render as the change. An async run
   * that a newer one overtook is dropped (Standard Schema takes no signal, so
   * stale results are discarded rather than aborted). Resolves to whether this
   * run was the latest.
   */
  private runSchema(): boolean | Promise<boolean> {
    const schema = this.schema;
    if (!schema) return true;
    const run = ++this.schemaRun;
    const result = schema["~standard"].validate(this.values);
    if (!isPromiseLike<StandardSchemaResult<TOutput>>(result)) {
      this.applySchema(result);
      return true;
    }
    this.schemaPending = true;
    this.emit();
    return Promise.resolve(result).then(
      (resolved) => {
        if (run !== this.schemaRun) return false;
        this.schemaPending = false;
        this.applySchema(resolved);
        this.emit();
        return true;
      },
      (error: unknown) => {
        if (run === this.schemaRun) {
          this.schemaPending = false;
          this.emit();
        }
        throw error;
      },
    );
  }

  private hasSchemaError(path: string): boolean {
    for (const key of this.schemaErrors.keys()) if (isWithin(key, path)) return true;
    return false;
  }

  /**
   * Runs the field's own check, after the schema has accepted the field (no
   * point asking a server whether an empty name is taken). A newer check aborts
   * the one in flight; an unchanged value is not asked again.
   */
  private runFieldCheck(path: string): Promise<void> {
    const validate = this.fields.get(path)?.validate;
    if (!validate) return Promise.resolve();
    const value = getIn(this.values, path);
    const inflight = this.pending.get(path);
    if (this.hasSchemaError(path)) {
      inflight?.controller.abort();
      this.pending.delete(path);
      this.fieldErrors.delete(path);
      this.checked.delete(path);
      return Promise.resolve();
    }
    if (inflight && deepEqual(inflight.value, value)) return inflight.promise;
    if (!inflight && this.checked.has(path) && deepEqual(this.checked.get(path), value)) return Promise.resolve();
    inflight?.controller.abort();

    const controller = new AbortController();
    const answer = (message: FieldValidatorResult) => {
      if (message) this.fieldErrors.set(path, message);
      else this.fieldErrors.delete(path);
      this.checked.set(path, value);
    };
    const result = validate(value, { signal: controller.signal, values: this.values });
    if (!isPromiseLike<FieldValidatorResult>(result)) {
      this.pending.delete(path);
      answer(result);
      return Promise.resolve();
    }
    const current = () => this.pending.get(path)?.controller === controller;
    // An aborted check settles at once for whoever waits on it (a submit), even
    // if the validator ignores its signal.
    const aborted = new Promise<typeof ABORTED>((resolve) =>
      controller.signal.addEventListener("abort", () => resolve(ABORTED), { once: true }),
    );
    const promise = Promise.race([Promise.resolve(result), aborted]).then(
      (message) => {
        if (message === ABORTED || !current()) return;
        this.pending.delete(path);
        answer(message);
        this.emit();
      },
      (error: unknown) => {
        // An aborted check's rejection is expected and ignored.
        if (!current()) return;
        this.pending.delete(path);
        this.emit();
        throw error;
      },
    );
    this.pending.set(path, { controller, value, promise });
    this.emit();
    return promise;
  }

  private validatePath(path: string): Promise<void> {
    const ran = this.runSchema();
    if (typeof ran === "boolean") return ran ? this.runFieldCheck(path) : Promise.resolve();
    return ran.then((latest) => (latest ? this.runFieldCheck(path) : undefined));
  }

  /** Runs the schema and every field check. Resolves to whether the form is free of errors. */
  validate = async (): Promise<boolean> => {
    const generation = this.generation;
    while ((await this.runSchema()) === false) {
      // A change started a newer run meanwhile; validate the latest values.
    }
    // Reset meanwhile: nothing left to check for these values.
    if (generation !== this.generation) return false;
    await Promise.all([...this.fields.keys()].map((path) => this.runFieldCheck(path)));
    this.emit();
    return !this.hasErrors();
  };

  private hasErrors(): boolean {
    return this.serverErrors.size > 0 || this.fieldErrors.size > 0 || this.schemaErrors.size > 0;
  }

  /** Every current error by path, for `onInvalid`. */
  getErrors = (): Record<string, string> =>
    Object.fromEntries(this.getErrorEntries().map((entry) => [entry.path, entry.message]));

  /**
   * Submits: marks every field reportable, validates, and on success hands the
   * schema's parsed output to `onValid`. Errors (the schema's, a check's, or the
   * server's set during `onValid`) fail the submit and request focus on the
   * first invalid field. A submit while one is running is ignored.
   */
  submit = async (
    onValid?: (output: TOutput, helpers: FormSubmitHelpers<TValues>) => void | Promise<void>,
    onInvalid?: (errors: Record<string, string>) => void,
  ): Promise<boolean> => {
    if (this.submitting) return false;
    this.submitting = true;
    this.submitCount += 1;
    this.submitFailed = false;
    this.serverErrors.delete("");
    this.emit();
    const generation = this.generation;
    try {
      const valid = await this.validate();
      // Reset meanwhile: the values this submit checked are gone.
      if (generation !== this.generation) return false;
      if (!valid) {
        this.fail();
        onInvalid?.(this.getErrors());
        return false;
      }
      const output = (this.schema ? this.output : this.values) as TOutput;
      await onValid?.(output, { setErrors: this.setErrors, reset: this.reset });
      if (this.hasErrors()) {
        this.fail();
        return false;
      }
      return true;
    } finally {
      this.submitting = false;
      this.emit();
    }
  };

  private fail(): void {
    this.submitFailed = true;
    this.focusRequest += 1;
  }

  /**
   * Focuses the first invalid field in DOM order (not registration order: a
   * row moved up comes first). Falls back to the error summary when no mounted
   * field carries an error. Returns whether focus moved.
   */
  focusFirstError = (): boolean => {
    const targets = this.getErrorEntries()
      .map((entry) => entry.field?.getElement())
      .filter((element): element is HTMLElement => element != null && element.isConnected);
    targets.sort((a, b) => (a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const target = targets[0] ?? (this.getErrorEntries().length > 0 ? this.summary : null);
    if (!target) return false;
    target.focus({ preventScroll: true });
    // Centred, so sticky chrome (a sticky FormActions bar) does not cover it.
    target.scrollIntoView?.({ block: "center" });
    return true;
  };

  // ── field arrays ────────────────────────────────────────────────────────

  private editRows(rawPath: string, edit: (rows: unknown[], keys: number[]) => void): void {
    const path = canonicalPath(rawPath);
    const current = getIn(this.values, path);
    const rows = Array.isArray(current) ? current.slice() : [];
    const before = this.rowKeys(path);
    const keys = before.slice();
    edit(rows, keys);
    // Every real edit changes the keys; an out-of-range move or removal does not.
    if (sameKeys(before, keys)) return;
    const moved = new Map<number, number>();
    before.forEach((key, from) => moved.set(from, keys.indexOf(key)));

    this.values = setIn(this.values, path, rows);
    this.arrayKeys.set(path, keys);
    // Errors and flags are keyed by index; each follows its row by key.
    this.schemaErrors = remapRows(this.schemaErrors, path, moved);
    this.fieldErrors = remapRows(this.fieldErrors, path, moved);
    this.serverErrors = remapRows(this.serverErrors, path, moved);
    this.reportable = remapRowSet(this.reportable, path, moved);
    this.touched = remapRowSet(this.touched, path, moved);
    // In-flight checks answer for a path that just changed meaning: drop them.
    for (const [key, check] of [...this.pending]) {
      if (isWithin(key, path)) {
        check.controller.abort();
        this.pending.delete(key);
      }
    }
    for (const key of [...this.checked.keys()]) if (isWithin(key, path)) this.checked.delete(key);

    this.reportable.add(path);
    this.settle(this.validatePath(path));
    this.emit();
  }

  append = (path: string, row: unknown): void =>
    this.editRows(path, (rows, keys) => {
      rows.push(row);
      keys.push(this.nextKey++);
    });

  insert = (path: string, index: number, row: unknown): void =>
    this.editRows(path, (rows, keys) => {
      const at = Math.max(0, Math.min(index, rows.length));
      rows.splice(at, 0, row);
      keys.splice(at, 0, this.nextKey++);
    });

  remove = (path: string, index: number): void =>
    this.editRows(path, (rows, keys) => {
      if (index < 0 || index >= rows.length) return;
      rows.splice(index, 1);
      keys.splice(index, 1);
    });

  move = (path: string, from: number, to: number): void =>
    this.editRows(path, (rows, keys) => {
      if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return;
      const [row] = rows.splice(from, 1);
      const [key] = keys.splice(from, 1);
      rows.splice(to, 0, row);
      keys.splice(to, 0, key as number);
    });

  replace = (path: string, next: readonly unknown[]): void =>
    this.editRows(path, (rows, keys) => {
      rows.splice(0, rows.length, ...next);
      keys.splice(0, keys.length, ...next.map(() => this.nextKey++));
    });
}
