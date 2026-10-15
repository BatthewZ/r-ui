import { SlidersHorizontal } from "lucide-react";
import { useLayoutEffect, useState } from "react";

import { Field } from "../../src/components/form";
import { Popover } from "../../src/components/overlays";
import { DensitySwitcher, InputSwitcher, ThemeSwitcher } from "../../src/components/preferences";
import { useDensity, useInputMode, useTheme } from "../../src/hooks/use-preferences";
import { PREFERENCES, type Reading, readTokens, THEMES } from "./view";

/**
 * The View panel: the library's preference switchers for the whole page, in a
 * library Popover, plus the showcase's own live readout of the tokens those
 * axes move.
 */
export function ViewPanel() {
  return (
    <Popover placement="bottom-end">
      <Popover.Trigger iconStart={<SlidersHorizontal aria-hidden className="size-icon" />}>View</Popover.Trigger>
      <Popover.Content aria-label="View settings" className="sc-panel">
        <Field>
          <Field.Label>Theme</Field.Label>
          {/* A select: an app's theme list grows, and four segments already truncate here. */}
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
        <Readout />
      </Popover.Content>
    </Popover>
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
