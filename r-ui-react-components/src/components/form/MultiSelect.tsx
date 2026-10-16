"use client";
import { ListChecks } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";
import {
  focusLastChip,
  focusLeaves,
  HiddenValues,
  SelectionChips,
  stringList,
  SelectionFrame,
  SelectionToggle,
  useAnnouncer,
} from "./selection-field";
import {
  buildSelectionList,
  type ComboboxFilter,
  type ComboboxOption,
  resultsStatus,
  type SelectionItem,
  SelectionListbox,
  useSelectionPopup,
} from "./selection-popup";
import { type LabelsProp, useLabels } from "../../util/locale";

/** Every string the control says, for localisation. */
export interface MultiSelectLabels {
  loading: string;
  empty: string;
  results: (count: number) => string;
  /** Names the chip list. */
  selected: string;
  /** The narrow field's stand-in for its chips. */
  summary: (count: number) => string;
  remove: (label: string) => string;
  added: (label: string, count: number) => string;
  removed: (label: string, count: number) => string;
  selectAll: string;
  /** Shown above the list, and announced, once `max` values are chosen. */
  max: (max: number) => string;
  toggle: string;
}

export const DEFAULT_MULTI_SELECT_LABELS: MultiSelectLabels = {
  loading: "Loading…",
  empty: "No results",
  results: (count) => (count === 1 ? "1 result" : `${count} results`),
  selected: "Selected",
  summary: (count) => `${count} selected`,
  remove: (label) => `Remove ${label}`,
  added: (label, count) => `${label} selected. ${count} selected.`,
  removed: (label, count) => `${label} removed. ${count} selected.`,
  selectAll: "Select all",
  max: (max) => `Up to ${max} can be selected.`,
  toggle: "Show options",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    MultiSelect: MultiSelectLabels;
  }
}

export interface MultiSelectProps
  extends Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue" | "type" | "size" | "children" | "name"> {
  options: readonly ComboboxOption[];
  /** Chosen values, in the order they were chosen. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (values: string[]) => void;
  /** The search text. Controlled for async search. */
  inputValue?: string;
  defaultInputValue?: string;
  onInputChange?: (text: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Default: contains, ignoring case and diacritics. `false`: show `options` as given. */
  filter?: ComboboxFilter | false;
  loading?: boolean;
  loadError?: string;
  /** A first row that chooses every listed (filtered, enabled) option, or clears them. */
  selectAll?: boolean;
  /** At most this many; the other options disable once it is reached. */
  max?: number;
  /** Submitted as one hidden input per value. */
  name?: string;
  invalid?: boolean;
  /** Lists longer than this are windowed. @default 100 */
  virtualizeThreshold?: number;
  labels?: LabelsProp<MultiSelectLabels>;
  /** `className` styles the root (width lands there); `ref` and the rest address the search `<input>`. */
  classNames?: SlotClassNames<"frame" | "input" | "chip" | "listbox" | "option">;
}

/**
 * Several choices from a list: a combobox whose chosen options are removable
 * chips inside the field. The list stays open while choosing; Enter or a press
 * toggles an option and clears the search. Backspace in an empty search removes
 * the last chip; each chip's remove button is in the tab order. In a field
 * narrower than the `column-md` container step (16rem), two or more chips fold
 * into an "n selected" button (ArrowLeft from the search reaches it) that
 * unfolds them, remove buttons and all, until focus leaves the control.
 */
export function MultiSelect({
  options,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  inputValue: inputValueProp,
  defaultInputValue = "",
  onInputChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  filter,
  loading = false,
  loadError,
  selectAll = false,
  max,
  name,
  invalid: invalidProp,
  virtualizeThreshold = 100,
  labels: labelsProp,
  className,
  classNames,
  ref,
  id: idProp,
  required: requiredProp,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  onChange,
  onKeyDown,
  onClick,
  onBlur,
  form,
  placeholder,
  ...props
}: MultiSelectProps) {
  const labels = useLabels("MultiSelect", DEFAULT_MULTI_SELECT_LABELS, labelsProp);
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  const locked = field.disabled === true || field.readOnly === true;
  const inputRef = useRef<HTMLInputElement>(null);
  // Stable, so the input's ref is never detached mid-commit (chip removal focuses it from a layout effect).
  const setInputRef = useMemo(() => mergeRefs(ref, inputRef), [ref]);
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [region, announce] = useAnnouncer();

  // Inside a Field bound to a Form (and with no `value`), the form owns the value.
  const [values, setValues, fieldName] = useFieldValue<string[]>({
    value: valueProp,
    defaultValue,
    onChange: onValueChange,
    fromForm: stringList,
  });
  const [text, setText] = useControllableState({ value: inputValueProp, defaultValue: defaultInputValue, onChange: onInputChange });
  // Labels of chosen options outlive the async results they came from.
  const knownLabels = useRef(new Map<string, string>());
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? knownLabels.current.get(v) ?? v;
  const chosen = new Set(values);
  const atMax = max !== undefined && values.length >= max;

  const isDisabled = (option: ComboboxOption) => atMax && !chosen.has(option.value);
  // A failed load lists no options: the cursor (and Enter) must not reach rows nobody sees.
  const listed = loadError === undefined ? options : [];
  // The select-all row acts on what is listed (filtered, enabled), so the list is read first.
  const enabledListed = buildSelectionList(listed, { query: text, filter, isDisabled }).items.flatMap((item) =>
    item.kind === "option" && !item.option.disabled ? [item.option] : [],
  );
  const allListedChosen = enabledListed.length > 0 && enabledListed.every((o) => chosen.has(o.value));
  const wouldExceed =
    max !== undefined && values.length + enabledListed.filter((o) => !chosen.has(o.value)).length > max;
  const top: SelectionItem[] = selectAll && loadError === undefined
    ? [
        {
          kind: "action",
          key: "all",
          label: labels.selectAll,
          icon: <ListChecks />,
          disabled: enabledListed.length === 0 || (!allListedChosen && wouldExceed),
        },
      ]
    : [];
  const list = buildSelectionList(listed, { query: text, filter, top, isDisabled });

  const popup = useSelectionPopup({ items: list.items, open: openProp, defaultOpen, onOpenChange });
  const { open, setOpen, activeIndex } = popup;
  const setReference = popup.floating.refs.setReference;
  const setFrameRef = useMemo(() => mergeRefs(frameRef, setReference), [setReference]);

  const toggle = (option: ComboboxOption) => {
    knownLabels.current.set(option.value, option.label);
    if (chosen.has(option.value)) {
      const next = values.filter((v) => v !== option.value);
      setValues(next);
      announce(labels.removed(option.label, next.length));
    } else {
      if (atMax) return announce(labels.max(max));
      const next = [...values, option.value];
      setValues(next);
      const reached = max !== undefined && next.length >= max ? ` ${labels.max(max)}` : "";
      announce(`${labels.added(option.label, next.length)}${reached}`);
    }
  };

  const commit = (index: number) => {
    const item = list.items[index];
    if (!item || item.disabled) return;
    if (item.kind === "option") toggle(item.option);
    else {
      const ids = enabledListed.map((o) => o.value);
      for (const o of enabledListed) knownLabels.current.set(o.value, o.label);
      const next = allListedChosen ? values.filter((v) => !ids.includes(v)) : [...values, ...ids.filter((v) => !chosen.has(v))];
      setValues(next);
      announce(labels.summary(next.length));
    }
    // A fresh search for the next choice; the cursor stays on what was chosen.
    if (text !== "") setText("");
  };

  const removeAt = (index: number) => {
    const removed = values[index];
    if (removed === undefined || locked) return;
    const next = values.filter((_, i) => i !== index);
    setValues(next);
    announce(labels.removed(labelOf(removed), next.length));
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    if (locked) return;
    if (!open) setOpen(true);
    popup.activateFirst();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (locked) return;
    if (popup.navigate(event)) return;
    if (focusLastChip(event, frameRef.current)) return;
    switch (event.key) {
      case "Enter":
        if (open) {
          // Never submit the form from an open list, highlighted option or not.
          event.preventDefault();
          if (activeIndex >= 0) commit(activeIndex);
        }
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          setText("");
        } else if (text !== "") {
          event.preventDefault();
          setText("");
        }
        return;
      case "Backspace":
        if (text === "" && values.length > 0) {
          event.preventDefault();
          removeAt(values.length - 1);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (!focusLeaves(rootRef.current, event)) return;
    setOpen(false);
    if (text !== "") setText("");
  };

  const status = open && text !== "" ? resultsStatus(list, { loading, loadError, labels }) : "";
  const many = values.length > 1;
  // A narrow field folds its chips into the summary; pressing it unfolds them
  // (their remove buttons with them) until focus leaves the control.
  const [unfolded, setUnfolded] = useState(false);
  const folded = many && !unfolded;
  const chipsId = useId();
  const focusChips = useRef(false);
  useLayoutEffect(() => {
    if (!focusChips.current) return;
    focusChips.current = false;
    const first = frameRef.current?.querySelector<HTMLButtonElement>(".r-primitives-chip-remove");
    (first ?? inputRef.current)?.focus();
  }, [unfolded]);

  return (
    <div
      ref={rootRef}
      className={cn("relative @container w-full min-w-0", className)}
      onBlur={(event) => {
        if (unfolded && focusLeaves(rootRef.current, event)) setUnfolded(false);
      }}
    >
      <SelectionFrame
        frameRef={setFrameRef}
        inputRef={inputRef}
        invalid={field.invalid}
        disabled={field.disabled}
        readOnly={field.readOnly}
        chips
        onPress={() => setOpen(true)}
        end={
          locked ? undefined : (
            <SelectionToggle popup={popup} label={labels.toggle} inputRef={inputRef} />
          )
        }
        className={classNames?.frame}
      >
        <SelectionChips
          id={chipsId}
          chips={values.map((v) => ({ key: v, label: labelOf(v) }))}
          label={labels.selected}
          removeLabel={labels.remove}
          onRemove={removeAt}
          inputRef={inputRef}
          disabled={field.disabled}
          readOnly={field.readOnly}
          // Narrow field: two or more chips fold into the summary below.
          className={cn(folded && "@max-column-md:hidden")}
          chipClassName={classNames?.chip}
        />
        {folded && (
          <button
            type="button"
            aria-expanded={false}
            aria-controls={chipsId}
            disabled={field.disabled}
            onClick={() => {
              focusChips.current = true;
              setUnfolded(true);
            }}
            onKeyDown={(event) => {
              const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
              if (event.key !== (rtl ? "ArrowLeft" : "ArrowRight")) return;
              event.preventDefault();
              inputRef.current?.focus();
            }}
            className="r-primitives-chip r-form-chip-summary hit-area hidden pe-r5 font-medium @max-column-md:inline-flex"
          >
            {labels.summary(values.length)}
          </button>
        )}
        <input
          ref={setInputRef}
          type="text"
          {...popup.comboboxProps}
          id={field.id}
          // Native validation sees an empty search; it may only stop the form while nothing is chosen.
          required={field.required && values.length === 0}
          aria-required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          {...field.ariaProps}
          form={form}
          placeholder={values.length === 0 ? placeholder : undefined}
          {...props}
          value={text}
          onChange={composeEventHandlers(onChange, handleChange)}
          onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
          onClick={composeEventHandlers(onClick, () => {
            if (!locked && !open) setOpen(true);
          })}
          onBlur={composeEventHandlers(onBlur, handleBlur)}
          className={cn("r-form-input r-form-chip-input min-w-0 bg-transparent text-body-1 text-fg-primary", classNames?.input)}
        />
      </SelectionFrame>
      <SelectionListbox
        popup={popup}
        list={list}
        multiple
        isSelected={(item) => (item.kind === "option" ? chosen.has(item.option.value) : allListedChosen)}
        query={text}
        onCommit={(index) => {
          commit(index);
          inputRef.current?.focus();
        }}
        labelledBy={field.labelId}
        label={props["aria-label"]}
        loading={loading}
        loadingMessage={labels.loading}
        error={loadError}
        emptyMessage={labels.empty}
        notice={atMax ? labels.max(max) : undefined}
        virtualizeThreshold={virtualizeThreshold}
        className={classNames?.listbox}
        optionClassName={classNames?.option}
      />
      <HiddenValues name={name ?? fieldName} values={values} form={form} />
      <span role="status" className="sr-only">
        {status}
      </span>
      {region}
    </div>
  );
}
