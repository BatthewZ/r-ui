import { DensitySwitcher, Field, InputSwitcher, Popover, ThemeSwitcher } from "@batthewz/r-ui-react-components";
import { SlidersHorizontal } from "lucide-react";

import { PREFERENCES, THEMES } from "./themes";

/** The library's preference switchers for the whole page, in a library Popover. */
export function ViewPanel() {
  return (
    <Popover placement="bottom-end">
      <Popover.Trigger variant="secondary" iconStart={<SlidersHorizontal aria-hidden className="size-icon" />}>
        View
      </Popover.Trigger>
      <Popover.Content aria-label="View settings" className="pg-panel">
        <Field>
          <Field.Label>Theme</Field.Label>
          <ThemeSwitcher themes={THEMES} storageKey={PREFERENCES.storageKey} variant="select" className="w-full" />
        </Field>
        <Field>
          <Field.Label>Density</Field.Label>
          <DensitySwitcher storageKey={PREFERENCES.storageKey} className="w-full" />
        </Field>
        <Field>
          <Field.Label>Input</Field.Label>
          <InputSwitcher storageKey={PREFERENCES.storageKey} className="w-full" />
        </Field>
        <p className="pg-note">A document&rsquo;s own <code>density</code> still wins inside its view.</p>
      </Popover.Content>
    </Popover>
  );
}
