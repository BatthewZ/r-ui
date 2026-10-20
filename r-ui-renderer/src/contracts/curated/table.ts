import type { ComponentContract } from "../../spec/types";

/** A curated contract field: component name → that field's value. */
export type CuratedTable<K extends keyof ComponentContract> = {
  readonly [name: string]: NonNullable<ComponentContract[K]>;
};
