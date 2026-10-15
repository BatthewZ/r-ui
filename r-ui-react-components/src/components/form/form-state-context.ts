import { createContext, useContext } from "react";

import type { FormStore } from "./form-state-store";

/** The store of the surrounding `Form`. Separate from `use-form` so `Field` can read it without importing the hook. */
export const FormStoreContext = createContext<FormStore<unknown, unknown> | null>(null);

export function useFormStore(): FormStore<unknown, unknown> | null {
  return useContext(FormStoreContext);
}
