"use client";
import { ChevronDown, Info, Pipette } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { subscribeNothing } from "../../hooks/use-store-snapshot";
import { ErrorLine } from "../../util/error-line";
import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";
import { Popover } from "../overlays";
import { IconButton } from "../primitives";
import {
  cssRgb,
  formatHex,
  formatOklch,
  hueMaxChroma,
  maxChroma,
  type Oklch,
  oklchToRgb,
  type ParsedColor,
  parseColorInput,
  parseCssColor,
  type Rgb,
} from "./color-core";
import { ColorArea, ColorSlider, type ContrastLabels, ContrastReadout, type SwatchOption, SwatchGroup } from "./color-controls";
import { useFieldControl, useFieldMessage, useFieldValue } from "./Field";
import { type LabelsProp, useLabels } from "../../util/locale";

/** A swatch: a colour (hex or `oklch()`), named for people who cannot see it. */
export interface ColorSwatch {
  value: string;
  label: string;
}

export interface ColorPickerLabels extends ContrastLabels {
  /** The trigger's name outside a Field (inside one, the Field's label names it). */
  trigger: string;
  /** The value text when there is no colour. */
  empty: string;
  /** The popup's name. */
  dialog: string;
  area: string;
  /** Announced as the area's kind: it is a slider with two axes. */
  areaRole: string;
  areaValue: (lightness: number, chroma: string) => string;
  hue: string;
  hueValue: (degrees: number) => string;
  alpha: string;
  alphaValue: (percent: number) => string;
  input: string;
  placeholder: string;
  invalid: (text: string) => string;
  outOfGamut: (asked: string, kept: string) => string;
  swatches: string;
  eyeDropper: string;
}

export const DEFAULT_COLOR_PICKER_LABELS: ColorPickerLabels = {
  trigger: "Colour",
  empty: "None",
  dialog: "Choose colour",
  area: "Lightness and chroma",
  areaRole: "2D slider",
  areaValue: (lightness, chroma) => `Lightness ${lightness}%, chroma ${chroma}`,
  hue: "Hue",
  hueValue: (degrees) => `${degrees}°`,
  alpha: "Opacity",
  alphaValue: (percent) => `${percent}%`,
  input: "Colour value",
  placeholder: "#rrggbb or oklch(L C H)",
  invalid: (text) => `“${text}” is not a colour. Use #rrggbb or oklch(L C H).`,
  outOfGamut: (asked, kept) => `Outside sRGB: chroma ${asked} is shown as ${kept}.`,
  swatches: "Swatches",
  eyeDropper: "Pick a colour from the screen",
  heading: (against) => `Contrast on ${against}`,
  pass: "passes",
  fail: "fails",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    ColorPicker: ColorPickerLabels;
  }
}

export interface ColorPickerProps
  extends Omit<ComponentPropsWithRef<"button">, "value" | "defaultValue" | "onChange" | "children" | "type"> {
  /** The colour in `format`, or `""` for none. */
  value?: string;
  defaultValue?: string;
  /** Every change: a drag, a key, a swatch, a typed entry on Enter or blur. */
  onValueChange?: (value: string) => void;
  /** The wire format of `value`: `#rrggbb` (`#rrggbbaa` with alpha) or `oklch(L C H [/ A])`. @default "hex" */
  format?: "hex" | "oklch";
  /** Show an opacity slider and keep alpha in the value. Off, alpha is dropped. */
  alpha?: boolean;
  /** Colours to choose from (a brand palette), as a radio group. */
  swatches?: readonly ColorSwatch[];
  /**
   * Show the WCAG contrast of the colour against `against` (any CSS colour,
   * a custom property included: `var(--C-SURFACE-0)` follows the theme),
   * named `label` in the readout.
   */
  contrast?: { against: string; label: string };
  /** Offer the EyeDropper API where the browser has it. @default true */
  eyeDropper?: boolean;
  invalid?: boolean;
  required?: boolean;
  readOnly?: boolean;
  /** The popup (controlled). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: LabelsProp<ColorPickerLabels>;
  /** `className` styles the root; `ref` and the rest address the trigger `<button>`. */
  classNames?: SlotClassNames<
    "trigger" | "swatch" | "value" | "panel" | "area" | "hue" | "alpha" | "input" | "note" | "swatches" | "contrast"
  >;
}

/** The editing state. `c` is the chroma asked for; what is shown is capped at the sRGB gamut. */
interface Edit extends Oklch {
  alpha: number;
}

const START: Edit = { l: 0.6, c: 0.12, h: 250, alpha: 1 };

const shown = (edit: Edit): Oklch => ({ l: edit.l, c: Math.min(edit.c, maxChroma(edit.l, edit.h)), h: edit.h });

function formatEdit(edit: Edit, format: "hex" | "oklch", alpha: boolean): string {
  const a = alpha ? edit.alpha : 1;
  return format === "hex" ? formatHex(oklchToRgb(shown(edit)), a) : formatOklch(shown(edit), a);
}

/** A parsed colour as an edit, keeping `hue` where the colour has none (a grey). */
const editOf = (parsed: ParsedColor, hue: number, alpha: boolean): Edit => ({
  ...parsed.color,
  h: parsed.color.c === 0 ? hue : parsed.color.h,
  alpha: alpha ? parsed.alpha : 1,
});

const hasEyeDropper = () => typeof window !== "undefined" && "EyeDropper" in window;

interface EyeDropperApi {
  open(): Promise<{ sRGBHex: string }>;
}

/**
 * A CSS colour resolved to sRGB where it paints: a custom property follows the
 * theme. Re-read when the root's attributes change (a theme switch).
 */
function useResolvedColor(css: string | undefined) {
  const probeRef = useRef<HTMLSpanElement>(null);
  const [rgb, setRgb] = useState<Rgb | null>(null);
  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe || css === undefined) return;
    const read = () => {
      const parsed = parseCssColor(getComputedStyle(probe).color);
      const next = parsed ? oklchToRgb(parsed.color) : null;
      setRgb((prev) => (prev && next && formatHex(prev) === formatHex(next) ? prev : next));
    };
    read();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [css]);
  return { rgb, probe: css === undefined ? null : <span ref={probeRef} hidden style={{ color: css }} /> };
}

/**
 * A colour field: a trigger showing the colour and its value as text, opening
 * a popup to choose it.
 *
 * - The popup (WAI-ARIA dialog, non-modal) renders in place and is promoted to
 *   the top layer, so a compact card gets a compact picker and no `overflow`
 *   clips it; it fades out. Focus starts on the area's thumb.
 * - The area is OKLCH lightness × chroma at the hue below it; the part sRGB
 *   cannot show is hatched. Arrows (Shift: ×10), Page Up/Down, Home/End.
 * - Typed entry reads `#rgb`, `#rrggbb`, `#rrggbbaa` and `oklch(L C H [/ A])`
 *   on Enter or blur. Text it cannot read is refused in the Field error's look,
 *   marks the field invalid and describes it (`useFieldMessage`); the value is
 *   unchanged. A colour outside sRGB is kept inside it by lowering chroma, and a
 *   note says so.
 * - The value is always shown as text, swatches are named radios, and the
 *   contrast readout is a ratio with AA/AAA by glyph and name: nothing is
 *   carried by colour alone.
 * - A `Field` control: label, description, error, disabled and read-only come
 *   from the surrounding `Field`; inside a bound `Field` the form owns the value,
 *   and `name` submits it through a hidden input.
 */
export function ColorPicker({
  value,
  defaultValue = "",
  onValueChange,
  format = "hex",
  alpha = false,
  swatches,
  contrast,
  eyeDropper = true,
  invalid: invalidProp,
  readOnly: readOnlyProp,
  disabled: disabledProp,
  required: requiredProp,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  labels: labelsProp,
  name,
  form,
  id: idProp,
  className,
  classNames,
  onClick,
  "aria-label": ariaLabel,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  ...props
}: ColorPickerProps) {
  const labels = useLabels("ColorPicker", DEFAULT_COLOR_PICKER_LABELS, labelsProp);
  const [current, setCurrent, fieldName] = useFieldValue<string>({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "string" ? raw : ""),
  });
  const submitName = name ?? fieldName;

  // The last edit, believed while it still formats to the value: it keeps hue
  // through greys and the chroma asked for past the gamut. A value that moved
  // for any other reason (a parent, the form, a reset) wins.
  const [memory, setMemory] = useState<Edit>(() => {
    const parsed = parseColorInput(current);
    return parsed ? editOf(parsed, START.h, alpha) : START;
  });
  const parsedValue = useMemo(() => parseColorInput(current), [current]);
  const edit =
    current === "" || formatEdit(memory, format, alpha) === current || !parsedValue
      ? memory
      : editOf(parsedValue, memory.h, alpha);
  const color = shown(edit);
  const rgb = oklchToRgb(color);
  const paint = cssRgb(rgb, alpha ? edit.alpha : 1);
  const hasValue = current !== "" && parsedValue !== null;

  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [draft, setDraft] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  // Closing (ours or a controlling parent's) drops a draft the popup no longer
  // shows, and its refusal with it.
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (!open) {
      setDraft(null);
      setRejected(null);
    }
  }

  const id = useId();
  const valueId = `${id}-value`;
  const nameId = `${id}-name`;
  const errorId = `${id}-error`;
  const noteId = `${id}-note`;
  // A refused entry makes the Field invalid and joins its description.
  useFieldMessage("error", errorId, rejected !== null);
  const field = useFieldControl({
    id: idProp,
    invalid: rejected !== null ? true : invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": [describedByProp, rejected !== null ? errorId : undefined].filter(Boolean).join(" ") || undefined,
    "aria-invalid": ariaInvalidProp,
  });

  const commit = (next: Edit) => {
    setMemory(next);
    setDraft(null);
    setRejected(null);
    setCurrent(formatEdit(next, format, alpha));
  };

  const options = useMemo<SwatchOption[]>(
    () =>
      (swatches ?? []).flatMap((swatch) => {
        const parsed = parseColorInput(swatch.value);
        if (!parsed) return [];
        const asEdit = editOf(parsed, 0, alpha);
        return [{ value: formatEdit(asEdit, format, alpha), label: swatch.label, paint: cssRgb(oklchToRgb(shown(asEdit)), asEdit.alpha) }];
      }),
    [swatches, format, alpha],
  );
  const chosenSwatch = options.find((o) => o.value === current);

  const commitText = () => {
    if (draft === null) return;
    if (draft.trim() === "") {
      setDraft(null);
      setRejected(null);
      return;
    }
    const parsed = parseColorInput(draft);
    if (!parsed) {
      setRejected(draft);
      return;
    }
    commit(editOf(parsed, edit.h, alpha));
  };

  const eyeDropperSupported = useSyncExternalStore(subscribeNothing, hasEyeDropper, () => false);
  const pickFromScreen = async () => {
    const Api = (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;
    if (!Api) return;
    try {
      const { sRGBHex } = await new Api().open();
      const parsed = parseCssColor(sRGBHex);
      if (parsed) commit(editOf({ ...parsed, alpha: edit.alpha }, edit.h, alpha));
    } catch {
      // Escape or a refused permission: nothing was picked.
    }
  };

  const background = useResolvedColor(contrast?.against);
  const ceiling = maxChroma(edit.l, edit.h);
  const outOfGamut = edit.c - ceiling > 0.0015;
  const axis = hueMaxChroma(edit.h);
  const huePaint = useMemo(() => hueTrack(), []);
  const interactive = !field.disabled && !field.readOnly;

  const onTriggerClick = composeEventHandlers(onClick, (event: MouseEvent<HTMLButtonElement>) => {
    // Read-only shows the value without offering to change it.
    if (field.readOnly) event.preventDefault();
  });

  const onTextKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Nothing pending (or already refused, unedited): Enter keeps its native job.
    if (event.key !== "Enter" || draft === null || rejected === draft) return;
    event.preventDefault();
    commitText();
  };

  const valueText = current === "" ? labels.empty : current;

  return (
    <div className={cn("grid min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen} placement="bottom-start">
        <Popover.Trigger asChild>
          <button
            {...props}
            type="button"
            id={field.id}
            disabled={field.disabled}
            {...field.ariaProps}
            aria-labelledby={`${field.labelId ?? nameId} ${valueId}`}
            data-invalid={field.invalid ? "" : undefined}
            data-disabled={field.disabled ? "" : undefined}
            data-readonly={field.readOnly ? "" : undefined}
            className={cn(
              "r-form-frame r-form-color-trigger flex h-control w-full min-w-0 items-center gap-r4 px-r3 text-start text-body-1 text-fg-primary",
              classNames?.trigger,
            )}
            onClick={onTriggerClick}
          >
            <span
              aria-hidden
              className={cn("r-form-color-chip", classNames?.swatch)}
              data-empty={hasValue ? undefined : ""}
              style={{ "--r-form-color-paint": hasValue ? paint : "transparent" } as CSSProperties}
            />
            <span id={valueId} className={cn("min-w-0 truncate", !hasValue && "text-fg-muted", classNames?.value)}>
              {valueText}
              {chosenSwatch && " "}
              {chosenSwatch && <span className="text-fg-secondary">· {chosenSwatch.label}</span>}
            </span>
            <ChevronDown aria-hidden className="ms-auto size-icon shrink-0 text-fg-muted" />
          </button>
        </Popover.Trigger>
        <span id={nameId} hidden>
          {ariaLabel ?? labels.trigger}
        </span>
        {interactive && (
          <Popover.Content
            aria-label={labels.dialog}
            className={cn(
              "grid w-[calc(var(--CONTROL-H)*7.5)] gap-r4",
              classNames?.panel,
            )}
          >
            <ColorArea
              hue={edit.h}
              l={color.l}
              c={color.c}
              axis={axis}
              label={labels.area}
              roleDescription={labels.areaRole}
              valueText={labels.areaValue(Math.round(color.l * 100), color.c.toFixed(3))}
              paint={cssRgb(rgb)}
              onChange={(l, c) => commit({ ...edit, l, c })}
              className={classNames?.area}
            />
            <ColorSlider
              label={labels.hue}
              value={Math.round(edit.h)}
              min={0}
              max={360}
              step={1}
              valueText={labels.hueValue(Math.round(edit.h))}
              track={huePaint.track}
              paint={huePaint.at(edit.h)}
              onChange={(h) => commit({ ...edit, h })}
              className={classNames?.hue}
            />
            {alpha && (
              <ColorSlider
                label={labels.alpha}
                value={Math.round(edit.alpha * 100)}
                min={0}
                max={100}
                step={1}
                valueText={labels.alphaValue(Math.round(edit.alpha * 100))}
                track={`linear-gradient(to right, ${cssRgb(rgb, 0)}, ${cssRgb(rgb, 1)})`}
                checker
                paint={paint}
                onChange={(percent) => commit({ ...edit, alpha: percent / 100 })}
                className={classNames?.alpha}
              />
            )}
            <div className="grid gap-r5">
              <div className="flex min-w-0 items-center gap-r4">
                <div className="r-form-frame r-form-text-frame flex h-control min-w-0 flex-1 items-center px-r3" data-invalid={rejected !== null ? "" : undefined}>
                  <input
                    type="text"
                    aria-label={labels.input}
                    aria-invalid={rejected !== null ? true : undefined}
                    aria-describedby={[rejected !== null ? errorId : undefined, outOfGamut ? noteId : undefined].filter(Boolean).join(" ") || undefined}
                    placeholder={labels.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    className={cn("r-form-input min-w-0 flex-1 self-stretch bg-transparent text-body-1 text-fg-primary", classNames?.input)}
                    value={draft ?? current}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      setRejected(null);
                    }}
                    onBlur={commitText}
                    onKeyDown={onTextKeyDown}
                  />
                </div>
                {eyeDropper && eyeDropperSupported && (
                  <IconButton label={labels.eyeDropper} icon={<Pipette />} variant="secondary" onClick={() => void pickFromScreen()} />
                )}
              </div>
              <ErrorLine id={errorId} aria-live="polite" icon={rejected === null ? null : undefined} className={cn(rejected === null && "sr-only")}>
                {rejected === null ? null : labels.invalid(rejected)}
              </ErrorLine>
              <p
                id={noteId}
                role="status"
                className={cn("flex items-start gap-r5 text-body-2 text-fg-secondary", !outOfGamut && "sr-only", classNames?.note)}
              >
                {outOfGamut && (
                  <>
                    <span className="flex h-(--BodyText-2-line-height) shrink-0 items-center">
                      <Info aria-hidden className="size-icon text-status-info" />
                    </span>
                    <span className="min-w-0 break-words">{labels.outOfGamut(edit.c.toFixed(3), ceiling.toFixed(3))}</span>
                  </>
                )}
              </p>
            </div>
            {options.length > 0 && (
              <SwatchGroup
                label={labels.swatches}
                options={options}
                selected={chosenSwatch?.value}
                onSelect={(option) => {
                  const parsed = parseColorInput(option.value);
                  if (parsed) commit(editOf(parsed, edit.h, alpha));
                }}
                className={classNames?.swatches}
              />
            )}
            {contrast && (
              <ContrastReadout
                color={rgb}
                alpha={alpha ? edit.alpha : 1}
                background={background.rgb}
                against={contrast.label}
                labels={labels}
                className={classNames?.contrast}
              />
            )}
          </Popover.Content>
        )}
      </Popover>
      {background.probe}
      {submitName !== undefined && <input type="hidden" name={submitName} form={form} disabled={field.disabled} value={current} />}
    </div>
  );
}

/**
 * The hue track: every hue at one lightness, each at the most chroma sRGB holds
 * there, so the rainbow is even and vivid whatever the current colour is.
 */
function hueTrack() {
  const at = (h: number) => {
    const l = 0.72;
    return cssRgb(oklchToRgb({ l, c: maxChroma(l, h), h }));
  };
  const stops = Array.from({ length: 13 }, (_, i) => at(i * 30));
  return { track: `linear-gradient(to right, ${stops.join(", ")})`, at };
}
