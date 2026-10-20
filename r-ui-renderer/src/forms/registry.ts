import type { FormApi } from "@batthewz/r-ui-react-components";

/** Form handles by form name, written by FormsRoot and read by the action dispatcher. */
export interface FormRegistry {
  get(name: string): FormApi<unknown, unknown> | undefined;
  set(name: string, api: FormApi<unknown, unknown> | undefined): void;
}

export function createFormRegistry(): FormRegistry {
  throw new Error("not implemented");
}
