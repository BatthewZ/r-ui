import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useLayoutEffect, useState } from "react";

import { Field } from "../../src/components/form";
import { DropdownMenu, Popover } from "../../src/components/overlays";
import { DensitySwitcher, InputSwitcher } from "../../src/components/preferences";
import { useDensity, useInputMode, useTheme } from "../../src/hooks/use-preferences";
import { ThemeSwatch } from "./ThemeSwatch";
import { PREFERENCES, type Reading, readTokens, THEMES } from "./view";

/**
 * The View panel: the showcase's theme menu and the library's density and input
 * switchers for the whole page, in a library Popover, plus a live readout of the
 * tokens those axes move.
 */
export function ViewPanel() {
  const themeLabel = useId();
  return (
    <Popover placement="bottom-end">
      {/* The Overview's hint opens the panel through this hook. */}
      <Popover.Trigger iconStart={<SlidersHorizontal aria-hidden className="size-icon" />} data-showcase-view-trigger="">
        View
      </Popover.Trigger>
      <Popover.Content aria-label="View settings" className="sc-panel">
        <Field>
          <Field.Label id={themeLabel}>Theme</Field.Label>
          <ThemeMenu labelledBy={themeLabel} />
        </Field>
        <Field>
          <Field.Label>Density</Field.Label>
          <DensitySwitcher storageKey={PREFERENCES.storageKey} className="w-full" />
        </Field>
        <Field>
          <Field.Label>Input</Field.Label>
          <InputSwitcher storageKey={PREFERENCES.storageKey} className="w-full" />
        </Field>
        <Readout />
      </Popover.Content>
    </Popover>
  );
}

/**
 * The themes as a menu, each named beside its swatch: a select cannot draw one. A choice
 * applies at once and leaves the menu open, so themes can be compared in place.
 */
function ThemeMenu({ labelledBy }: { labelledBy: string }) {
  const { theme, setTheme } = useTheme(PREFERENCES);
  const trigger = useId();
  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  return (
    <DropdownMenu placement="bottom-start">
      {/* Named "Theme, <current>": the label alone would hide the value, the content alone the purpose. */}
      <DropdownMenu.Trigger
        id={trigger}
        variant="secondary"
        aria-labelledby={`${labelledBy} ${trigger}`}
        iconEnd={<ChevronDown aria-hidden className="size-icon" />}
        className="sc-theme-trigger"
        classNames={{ label: "sc-theme-trigger-label" }}
      >
        <ThemeSwatch theme={current.value} className="sc-swatch-sm" />
        {current.label}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content aria-labelledby={labelledBy}>
        <DropdownMenu.RadioGroup
          aria-labelledby={labelledBy}
          value={theme}
          onValueChange={(next) => {
            const pick = THEMES.find((t) => t.value === next);
            if (pick) setTheme(pick.value);
          }}
        >
          {THEMES.map((t) => (
            // The selection pair, not just the radio dot: beside the swatches, a dot is easy to miss.
            <DropdownMenu.RadioItem
              key={t.value}
              value={t.value}
              className="aria-checked:bg-selection aria-checked:font-semibold aria-checked:text-fg-on-selection"
            >
              <span className="sc-theme-option">
                {t.label}
                <ThemeSwatch theme={t.value} className="sc-swatch-sm" />
              </span>
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/** Re-measured whenever an axis moves (and on resize), so it never shows the previous view. */
function Readout() {
  const { theme } = useTheme(PREFERENCES);
  const { density } = useDensity(PREFERENCES);
  const { input, resolved } = useInputMode(PREFERENCES);
  const [readings, setReadings] = useState<Reading[]>([]);

  useLayoutEffect(() => {
    const refresh = () => setReadings(readTokens());
    refresh();
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, [theme, density, input, resolved]);

  return (
    <>
      {input === "auto" && (
        <p className="sc-panel-note">
          Input auto resolves to <strong>{resolved}</strong> on this device.
        </p>
      )}
      <dl className="sc-readout" aria-live="polite">
        {readings.map((r) => (
          <div key={r.token}>
            <dt>{r.token}</dt>
            <dd>{r.value === r.px ? r.px : `${r.value} · ${r.px}`}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
