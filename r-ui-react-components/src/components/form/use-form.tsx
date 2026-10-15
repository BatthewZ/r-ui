"use client";
import { type ComponentPropsWithRef, type SubmitEvent, type SyntheticEvent, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import { FormStoreContext, useFormStore } from "./form-state-context";
import { canonicalPath } from "./form-state-path";
import type { StandardSchemaInput, StandardSchemaOutput, StandardSchemaV1 } from "./form-state-schema";
import {
  type FieldArraySnapshot,
  type FieldValidatorResult,
  FormStore,
  type FormStateSnapshot,
  type FormSubmitHelpers,
  type ValidationTrigger,
} from "./form-state-store";

interface FormOptions<TValues, TOutput> {
  /** Every field's starting value. `reset()` returns here; `dirty` compares against it. */
  defaultValues: TValues;
  /**
   * When a field is first checked. Default `"blur"`: nothing is flagged while
   * the user is still typing their first answer. After a submit every field is checked.
   */
  validateOn?: ValidationTrigger;
  /**
   * When a field that has been checked (or every field, after a submit) is
   * checked again. Default `"change"`, so an error clears as it is fixed.
   */
  revalidateOn?: ValidationTrigger;
  /** Called with the schema's parsed output once the form is valid. Async keeps `submitting` on. */
  onSubmit?: (output: TOutput, helpers: FormSubmitHelpers<TValues>) => void | Promise<void>;
  /** Called with the errors by path when a submit stops on them. */
  onInvalid?: (errors: Record<string, string>) => void;
}

export interface UseFormOptions<TValues, TOutput = TValues> extends FormOptions<TValues, TOutput> {
  /** Any Standard Schema validator (Zod, Valibot, ArkType…). Its output is what `onSubmit` receives. */
  schema?: StandardSchemaV1<TValues, TOutput>;
}

export interface FormApi<TValues, TOutput = TValues> {
  /** The store `Form` provides to its Fields. */
  store: FormStore<TValues, TOutput>;
  /** Form-level state; the component calling `useForm` re-renders when it changes. */
  state: FormStateSnapshot;
  /** Validates and, when valid, calls `onSubmit`. What `<Form>` runs on a native submit. */
  submit: () => Promise<boolean>;
  getValues: () => TValues;
  getValue: (path: string) => unknown;
  /** Sets a value as a control would (re-checks per `revalidateOn`). */
  setValue: (path: string, value: unknown) => void;
  /** Errors from the server by path; `""` is the form as a whole. Cleared when that value changes. */
  setErrors: (errors: Record<string, FieldValidatorResult>) => void;
  /** Back to the defaults (or new ones), with every error, touched flag and pending check dropped. */
  reset: (values?: TValues) => void;
  /** Runs every check without submitting. Errors show only on fields the user has reached. */
  validate: () => Promise<boolean>;
  focusFirstError: () => boolean;
}

/**
 * Form state for a `Form`: values (nested paths, field arrays), Standard
 * Schema validation plus per-field async checks, touched/dirty/submitting, and
 * server errors by path. Fields bind by `name`; no per-control wiring.
 *
 * ```tsx
 * const form = useForm({ schema, defaultValues, onSubmit: (rule) => save(rule) });
 * <Form form={form}>
 *   <ErrorSummary />
 *   <Field name="name"><Field.Label>Name</Field.Label><Input /><Field.Error /></Field>
 *   <FormActions><FormActions.Submit>Save</FormActions.Submit></FormActions>
 * </Form>
 * ```
 */
export function useForm<S extends StandardSchemaV1>(
  options: FormOptions<StandardSchemaInput<S>, StandardSchemaOutput<S>> & { schema: S },
): FormApi<StandardSchemaInput<S>, StandardSchemaOutput<S>>;
export function useForm<TValues>(options: FormOptions<TValues, TValues> & { schema?: undefined }): FormApi<TValues>;
export function useForm(options: UseFormOptions<unknown, unknown>): FormApi<unknown, unknown> {
  const storeRef = useRef<FormStore<unknown, unknown> | null>(null);
  storeRef.current ??= new FormStore(options);
  const store = storeRef.current;
  // The store keeps its values; options a re-render may change are re-read.
  store.configure(options);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const state = useSyncExternalStore(store.subscribe, store.getFormSnapshot, store.getFormSnapshot);
  const submit = useCallback(
    () =>
      store.submit(
        (output, helpers) => optionsRef.current.onSubmit?.(output, helpers),
        (errors) => optionsRef.current.onInvalid?.(errors),
      ),
    [store],
  );

  return useMemo<FormApi<unknown, unknown>>(
    () => ({
      store,
      state,
      submit,
      getValues: store.getValues,
      getValue: store.getValue,
      setValue: store.change,
      setErrors: store.setErrors,
      reset: store.reset,
      validate: store.validate,
      focusFirstError: store.focusFirstError,
    }),
    [store, state, submit],
  );
}

const report = (error: unknown) => {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else console.error(error);
};

export interface FormProps<TValues, TOutput> extends Omit<ComponentPropsWithRef<"form">, "onSubmit" | "onReset" | "noValidate"> {
  form: FormApi<TValues, TOutput>;
}

/**
 * A native `<form>` bound to `useForm`: Enter in a field submits, a
 * `type="reset"` button resets, and `noValidate` leaves the messages to the
 * form (the controls keep `required` for assistive tech). After a failed
 * submit, focus moves to the first invalid field in DOM order. `action` and
 * `method` pass through, so the markup still posts without JavaScript.
 */
export function Form<TValues, TOutput>({ form, children, ...props }: FormProps<TValues, TOutput>) {
  const { store, submit, reset } = form;
  const { focusRequest } = useSyncExternalStore(store.subscribe, store.getFormSnapshot, store.getFormSnapshot);
  // After the commit that rendered the errors, so the field is announced with its message.
  useEffect(() => {
    if (focusRequest > 0) store.focusFirstError();
  }, [store, focusRequest]);

  return (
    <FormStoreContext value={store as unknown as FormStore<unknown, unknown>}>
      <form
        {...props}
        noValidate
        onSubmit={(event: SubmitEvent<HTMLFormElement>) => {
          event.preventDefault();
          submit().catch(report);
        }}
        onReset={(event: SyntheticEvent<HTMLFormElement>) => {
          event.preventDefault();
          reset();
        }}
      >
        {children}
      </form>
    </FormStoreContext>
  );
}

/** Any form's API, as far as these hooks read it (`FormApi<T>` is not assignable to `FormApi<unknown>`). */
export interface FormHandle {
  store: Pick<
    FormStore<unknown, unknown>,
    "subscribe" | "getFormSnapshot" | "getArraySnapshot" | "getValue" | "append" | "insert" | "remove" | "move" | "replace"
  >;
}

const subscribeNothing = () => () => {};
const NO_FORM = (hook: string) => new Error(`${hook} needs a <Form> around it, or the form as its last argument.`);

/** The surrounding (or given) form's state: submitting, submitCount, dirty, validating… */
export function useFormState(form?: FormHandle): FormStateSnapshot {
  const contextStore = useFormStore();
  const store = form?.store ?? contextStore;
  const getSnapshot = () => store?.getFormSnapshot();
  const state = useSyncExternalStore(store?.subscribe ?? subscribeNothing, getSnapshot, getSnapshot);
  if (!state) throw NO_FORM("useFormState");
  return state;
}

/** One value of the surrounding (or given) form, re-rendering only when it changes. */
export function useFormValue<T = unknown>(name: string, form?: FormHandle): T {
  const contextStore = useFormStore();
  const store = form?.store ?? contextStore;
  const getSnapshot = () => store?.getValue(name);
  const value = useSyncExternalStore(store?.subscribe ?? subscribeNothing, getSnapshot, getSnapshot);
  if (!store) throw NO_FORM("useFormValue");
  return value as T;
}

export interface FieldArrayItem {
  /** Stable across moves and removals: use it as the row's React `key`. */
  key: string;
  index: number;
  /** The row's path (`conditions[2]`); a field in it is `${name}.metric`. */
  name: string;
}

export interface UseFieldArrayReturn<TRow> {
  items: FieldArrayItem[];
  /** An error about the list itself (too few rows). */
  error: string | undefined;
  append: (row: TRow) => void;
  insert: (index: number, row: TRow) => void;
  remove: (index: number) => void;
  move: (from: number, to: number) => void;
  replace: (rows: readonly TRow[]) => void;
}

const NO_ROWS: FieldArraySnapshot = { keys: [], error: undefined };

/**
 * A list of rows in the surrounding (or given) form. Each row's errors,
 * touched state and key follow it through moves and removals.
 */
export function useFieldArray<TRow = unknown>(name: string, form?: FormHandle): UseFieldArrayReturn<TRow> {
  const contextStore = useFormStore();
  const store = form?.store ?? contextStore;
  const path = canonicalPath(name);
  const getSnapshot = () => store?.getArraySnapshot(path) ?? NO_ROWS;
  const { keys, error } = useSyncExternalStore(store?.subscribe ?? subscribeNothing, getSnapshot, getSnapshot);
  const items = useMemo(
    () => keys.map((key, index) => ({ key: String(key), index, name: `${path}[${index}]` })),
    [keys, path],
  );
  const actions = useMemo(
    () => ({
      append: (row: TRow) => store?.append(path, row),
      insert: (index: number, row: TRow) => store?.insert(path, index, row),
      remove: (index: number) => store?.remove(path, index),
      move: (from: number, to: number) => store?.move(path, from, to),
      replace: (rows: readonly TRow[]) => store?.replace(path, rows),
    }),
    [store, path],
  );
  if (!store) throw NO_FORM("useFieldArray");
  return { items, error, ...actions };
}
