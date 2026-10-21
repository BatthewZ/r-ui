import type { FormApi } from "@batthewz/r-ui-react-components";

import type { FormHandles } from "../runtime/context";
import type { FormDef, FormRefState } from "../spec/types";
import { type FormOutput, type FormValues, formOutput } from "./compile";

/** A declared form's API: the library's `useForm` result over the compiled schema. */
export type ViewFormApi = FormApi<FormValues, FormOutput>;

export interface FormsSnapshot {
  readonly handles: FormHandles;
  readonly values: { readonly [name: string]: FormRefState };
}

/**
 * The mounted forms of one view, by name: written by FormsRoot's hosts, read
 * by the action dispatcher (`submitForm`, `resetForm`, `forms.…` refs) and,
 * as a snapshot that changes with every form change, by the render.
 */
export interface FormRegistry {
  get(name: string): ViewFormApi | undefined;
  /** Registers (or updates) the handle of a mounted form. */
  publish(name: string, api: ViewFormApi, def: FormDef): void;
  /** Drops `name` if `store` is still the one registered under it. */
  unpublish(name: string, store: ViewFormApi["store"]): void;
  readonly subscribe: (listener: () => void) => () => void;
  /** Stable until a form is published, dropped or changes. */
  readonly getSnapshot: () => FormsSnapshot;
}

interface Entry {
  readonly api: ViewFormApi;
  readonly def: FormDef;
  readonly unsubscribe: () => void;
}

/** What `forms.<name>` reads: the values as JSON, the errors on show, the form's state. */
function formRefState(api: ViewFormApi, def: FormDef): FormRefState {
  const { store } = api;
  const state = store.getFormSnapshot();
  return {
    values: formOutput(def, store.getValues()),
    errors: store.getErrors(),
    submitting: state.submitting,
    dirty: state.dirty,
    submitCount: state.submitCount,
    submitFailed: state.submitFailed,
  };
}

const EMPTY_SNAPSHOT: FormsSnapshot = Object.freeze({ handles: Object.freeze({}), values: Object.freeze({}) });

export function createFormRegistry(): FormRegistry {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let version = 0;
  let cached: { version: number; snapshot: FormsSnapshot } = { version, snapshot: EMPTY_SNAPSHOT };

  const changed = () => {
    version += 1;
    for (const listener of [...listeners]) listener();
  };

  return {
    get: (name) => entries.get(name)?.api,
    publish(name, api, def) {
      const previous = entries.get(name);
      if (previous?.api === api && previous.def === def) return;
      let unsubscribe: () => void;
      if (previous?.api.store === api.store) unsubscribe = previous.unsubscribe;
      else {
        previous?.unsubscribe();
        unsubscribe = api.store.subscribe(changed);
      }
      entries.set(name, { api, def, unsubscribe });
      changed();
    },
    unpublish(name, store) {
      const entry = entries.get(name);
      if (entry?.api.store !== store) return;
      entry.unsubscribe();
      entries.delete(name);
      changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      if (cached.version !== version) {
        const handles: { [name: string]: ViewFormApi } = {};
        const values: { [name: string]: FormRefState } = {};
        for (const [name, entry] of entries) {
          handles[name] = entry.api;
          values[name] = formRefState(entry.api, entry.def);
        }
        cached = { version, snapshot: { handles, values } };
      }
      return cached.snapshot;
    },
  };
}
