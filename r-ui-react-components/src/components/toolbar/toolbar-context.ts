"use client";
import { createContext, useContext } from "react";

/*
 * What a Toolbar tells the parts inside it. Internal to the toolbar group.
 *
 * A part that can move into the overflow menu is rendered twice: once in the
 * bar (kept mounted, hidden while overflowed, so it can still be measured) and
 * once in the menu, in its menu form. The two are separate instances, so an
 * uncontrolled part keeps its value in the toolbar (`useSharedValue`), where
 * both renderings read it.
 */

export type ToolbarOrientation = "horizontal" | "vertical";

/** Set inside a Toolbar: its orientation, and that its roving focus owns the arrows. */
export const ToolbarContext = createContext<{ orientation: ToolbarOrientation } | null>(null);

/** True inside the overflow menu: parts render their menu form. */
export const MenuFormContext = createContext(false);

/** The key of the unit (a Toolbar child, or a Toolbar.Group child) a part renders in, the same in the bar and the menu. */
export const UnitKeyContext = createContext<string | undefined>(undefined);

export interface SharedValues {
  values: Readonly<Record<string, unknown>>;
  set: (key: string, value: unknown) => void;
}

export const SharedValuesContext = createContext<SharedValues | null>(null);

/**
 * An uncontrolled part's value as its bar and menu renderings share it: the
 * toolbar holds it under the part's unit key, starting at `defaultValue`.
 * `undefined` outside a toolbar, where the part keeps its own state.
 */
export function useSharedValue<T>(defaultValue: T): { value: T; set: (next: T) => void } | undefined {
  const shared = useContext(SharedValuesContext);
  const key = useContext(UnitKeyContext);
  if (!shared || key === undefined) return undefined;
  return {
    value: key in shared.values ? (shared.values[key] as T) : defaultValue,
    set: (next) => shared.set(key, next),
  };
}
