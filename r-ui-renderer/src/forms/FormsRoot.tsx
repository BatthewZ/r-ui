import { useForm } from "@batthewz/r-ui-react-components";
import { type ReactNode, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ActionFailure } from "../runtime/actions";
import type { ActionDispatcher, IssueReporter, RefRoots, StreamingState } from "../runtime/context";
import { isHandler, isName, isOneOf, isPlainObject, ownValue } from "../spec/guards";
import { appendPointer } from "../spec/pointer";
import { parseRefPath, readRef } from "../spec/ref-path";
import { makeIssue } from "../spec/issue";
import { type FormDef, VALIDATION_TRIGGERS } from "../spec/types";
import { compileFormSchema, formDefaults, formDefHash, formDefProblems, formDefRefs } from "./compile";
import type { FormRegistry, FormsSnapshot, ViewFormApi } from "./registry";

export type { FormsSnapshot } from "./registry";

type Roots = Omit<RefRoots, "forms">;

export interface FormsRootProps {
  /** The document's `forms` object as far as it has arrived. */
  readonly defs: unknown;
  readonly streaming: StreamingState;
  /** For initial values that `$ref` data or state. */
  readonly roots: Roots;
  readonly dispatch: ActionDispatcher;
  readonly registry: FormRegistry;
  readonly report: IssueReporter;
  readonly children: (forms: FormsSnapshot) => ReactNode;
}

/** Whether every `data.…` an initial value reads has loaded or failed. */
function refsSettled(def: FormDef, roots: Roots): boolean {
  return formDefRefs(def).every((path) => {
    const parsed = parseRefPath(path);
    if (parsed?.root !== "data") return true;
    const binding = parsed.segments[0];
    return binding === undefined || ownValue(roots.status, binding) !== "loading";
  });
}

function isFormDefShape(value: unknown): value is FormDef {
  return isPlainObject(value) && isPlainObject(value.fields);
}

const resolverFor = (roots: Roots) => (path: string) => readRef(path, roots);

/** `{ errors: { field: message } }` from a failed request's body, when it has that shape. */
function serverFieldErrors(error: unknown): Record<string, string> | undefined {
  const body = error instanceof ActionFailure ? error.response?.body : undefined;
  if (!isPlainObject(body) || !isPlainObject(body.errors)) return undefined;
  const entries = Object.entries(body.errors).filter(
    (entry): entry is [string, string] =>
      isName(entry[0]) && typeof entry[1] === "string" && entry[1] !== "",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

interface FormHostProps {
  readonly name: string;
  readonly def: FormDef;
  /** The whole document has arrived. */
  readonly complete: boolean;
  readonly roots: Roots;
  readonly dispatch: ActionDispatcher;
  readonly registry: FormRegistry;
}

/** One form's `useForm`, published to the registry. Renders nothing. */
function FormHost({ name, def, complete, roots, dispatch, registry }: FormHostProps): null {
  const [defaultValues] = useState(() => formDefaults(def, resolverFor(roots)));
  const latest = useRef({ def, complete, roots, dispatch });
  useLayoutEffect(() => {
    latest.current = { def, complete, roots, dispatch };
  });
  const schema = useMemo(() => compileFormSchema(def), [def]);
  const path = appendPointer("/forms", name);

  const api = useForm({
    defaultValues,
    schema,
    validateOn: isOneOf(VALIDATION_TRIGGERS, def.validateOn) ? def.validateOn : undefined,
    revalidateOn: isOneOf(VALIDATION_TRIGGERS, def.revalidateOn) ? def.revalidateOn : undefined,
    onSubmit: async (output, helpers) => {
      const handler = latest.current.def.onSubmit;
      if (!isHandler(handler)) return;
      try {
        await latest.current.dispatch(handler, { args: [output], vars: {}, path: appendPointer(path, "onSubmit") });
      } catch (error) {
        // A server's field errors show on their fields; any other failure on the form, so the submit fails.
        helpers.setErrors(serverFieldErrors(error) ?? { "": error instanceof Error ? error.message : "The form was not sent." });
      }
    },
    onInvalid: (errors) => {
      const handler = latest.current.def.onInvalid;
      if (!isHandler(handler)) return;
      latest.current.dispatch(handler, { args: [errors], vars: {}, path: appendPointer(path, "onInvalid") }).catch(() => {
        // Reported by the dispatcher.
      });
    },
  });

  const handle = useMemo<ViewFormApi>(
    () => ({
      ...api,
      // Actions are inert until the document has arrived, so a submit could not run `onSubmit`: until then it does nothing at all.
      submit: () => (latest.current.complete ? api.submit() : Promise.resolve(false)),
      // Re-reads initial values that `$ref` data or state.
      reset: (values) => api.reset(values ?? formDefaults(latest.current.def, resolverFor(latest.current.roots))),
    }),
    [api],
  );
  const { store } = api;
  useLayoutEffect(() => {
    registry.publish(name, handle, def);
  }, [registry, name, handle, def]);
  useLayoutEffect(() => () => registry.unpublish(name, store), [registry, name, store]);
  return null;
}

/**
 * One FormHost per form def, each calling the library's `useForm` once (keyed
 * by `formDefHash`), publishing its handle to `registry` and to `children`. A
 * form mounts once its def has closed and its initial `$ref`s have resolved
 * (or their binding failed), and is never re-keyed after that.
 */
export function FormsRoot(props: FormsRootProps): ReactNode {
  const { defs, streaming, roots, dispatch, registry, report, children } = props;
  const snapshot = useSyncExternalStore(registry.subscribe, registry.getSnapshot, registry.getSnapshot);
  // Keys that have mounted once: a later refetch (status back to loading) must not unmount them.
  const [mounted] = useState(() => new Set<string>());

  const hosts: ReactNode[] = [];
  if (isPlainObject(defs)) {
    for (const name of Object.keys(defs)) {
      const path = appendPointer("/forms", name);
      if (streaming.pending.has(path) || !isName(name)) continue;
      const formDef = defs[name];
      if (!isFormDefShape(formDef)) {
        report(makeIssue("invalid-value", path, `Form "${name}" has no \`fields\` object.`));
        continue;
      }
      for (const problem of formDefProblems(formDef)) {
        report(makeIssue("invalid-value", path + problem.path, problem.message));
      }
      const key = `${name}\u0000${formDefHash(formDef)}`;
      if (!mounted.has(key)) {
        if (!refsSettled(formDef, roots)) continue;
        mounted.add(key);
      }
      hosts.push(
        <FormHost key={key} name={name} def={formDef} complete={streaming.complete} roots={roots} dispatch={dispatch} registry={registry} />,
      );
    }
  }

  return (
    <>
      {hosts}
      {children(snapshot)}
    </>
  );
}
