import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useState } from "react";

import {
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "../../src/hooks/use-floating";
import { useMediaQuery } from "../../src/hooks/use-media-query";
import {
  applyView,
  DENSITIES,
  INPUTS,
  type Reading,
  readTokens,
  readView,
  THEMES,
  type View,
} from "./view";

const LABELS: Record<string, string> = {
  default: "Default",
  nightfall: "Nightfall",
  harbour: "Harbour",
  comfortable: "Comfortable",
  compact: "Compact",
  auto: "Auto",
  fine: "Fine",
  coarse: "Coarse",
};

/**
 * The View menu: theme, density and input for the whole page, plus a live
 * readout of the tokens those axes move. Dogfoods the library's floating
 * model: the panel renders IN PLACE next to its trigger and `useFloating`
 * promotes it to the top layer.
 */
export function ViewPanel() {
  const [view, setView] = useState<View>(readView);
  const [open, setOpen] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const coarse = useMediaQuery("(pointer: coarse)");
  const panelId = useId();

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: "dialog" }),
  ]);

  // Apply before paint so the readout never measures the previous view.
  useLayoutEffect(() => applyView(view), [view]);

  const refresh = useCallback(() => setReadings(readTokens()), []);
  useLayoutEffect(() => {
    if (open) refresh();
  }, [open, view, coarse, refresh]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, [open, refresh]);

  const set = <K extends keyof View>(key: K, value: View[K]) => setView((v) => ({ ...v, [key]: value }));

  return (
    <div>
      <button
        ref={refs.setReference}
        type="button"
        className="sc-button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        {...getReferenceProps({ onClick: () => setOpen((o) => !o) })}
      >
        <SlidersHorizontal aria-hidden className="size-icon" />
        <span>View</span>
      </button>
      {open && (
        <div
          ref={refs.setFloating}
          id={panelId}
          aria-label="View settings"
          className="sc-panel"
          style={floatingStyles}
          {...getFloatingProps()}
        >
          <Segmented name="theme" legend="Theme" options={THEMES} value={view.theme} onChange={(v) => set("theme", v)} />
          <Segmented
            name="density"
            legend="Density"
            options={DENSITIES}
            value={view.density}
            onChange={(v) => set("density", v)}
          />
          <Segmented name="input" legend="Input" options={INPUTS} value={view.input} onChange={(v) => set("input", v)} />
          <p className="sc-panel-note">
            Input auto resolves to <strong>{coarse ? "coarse" : "fine"}</strong> on this device.
          </p>
          <dl className="sc-readout" aria-live="polite">
            {readings.map((r) => (
              <div key={r.token}>
                <dt>{r.token}</dt>
                <dd>
                  {r.value === r.px ? r.px : `${r.value} · ${r.px}`}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  name: string;
  legend: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ name, legend, options, value, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className="sc-field">
      <legend>{legend}</legend>
      <div className="sc-seg">
        {options.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{LABELS[option] ?? option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
