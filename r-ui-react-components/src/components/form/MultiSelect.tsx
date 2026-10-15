"use client";
import { ListChecks } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  useMemo,
  useRef,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";
import {
  focusLastChip,
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
  type SelectionItem,
  SelectionListbox,
  useSelectionPopup,
} from "./selection-popup";

/** Every string the control says, for localisation. */
export interface MultiSelectMessages {
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

const MESSAGES: MultiSelectMessages = {
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
  messages?: Partial<MultiSelectMessages>;
  /** `className` styles the root (width lands there); `ref` and the rest address the search `<input>`. */
  classNames?: SlotClassNames<"frame" | "input" | "chip" | "listbox" | "option">;
}

/**
 * Several choices from a list: a combobox whose chosen options are removable
 * chips inside the field. The list stays open while choosing; Enter or a press
 * toggles an option and clears the search. Backspace in an empty search removes
 * the last chip; each chip's remove button is in the tab order. In a field
 * narrower than the `column-md` container step (16rem), two or more chips fold into "n selected".
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
  messages: messagesProp,
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
  const messages = { ...MESSAGES, ...messagesProp };
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
  const labels = useRef(new Map<string, string>());
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? labels.current.get(v) ?? v;
  const chosen = new Set(values);
  const atMax = max !== undefined && values.length >= max;

  const isDisabled = (option: ComboboxOption) => atMax && !chosen.has(option.value);
  // The select-all row acts on what is listed (filtered, enabled), so the list is read first.
  const enabledListed = buildSelectionList(options, { query: text, filter, isDisabled }).items.flatMap((item) =>
    item.kind === "option" && !item.option.disabled ? [item.option] : [],
  );
  const allListedChosen = enabledListed.length > 0 && enabledListed.every((o) => chosen.has(o.value));
  const wouldExceed =
    max !== undefined && values.length + enabledListed.filter((o) => !chosen.has(o.value)).length > max;
  const top: SelectionItem[] = selectAll
    ? [
        {
          kind: "action",
          key: "all",
          label: messages.selectAll,
          icon: <ListChecks />,
          disabled: enabledListed.length === 0 || (!allListedChosen && wouldExceed),
        },
      ]
    : [];
  const list = buildSelectionList(options, { query: text, filter, top, isDisabled });

  const popup = useSelectionPopup({ items: list.items, open: openProp, defaultOpen, onOpenChange });
  const { open, setOpen, activeIndex } = popup;
  const setReference = popup.floating.refs.setReference;
  const setFrameRef = useMemo(() => mergeRefs(frameRef, setReference), [setReference]);

  const toggle = (option: ComboboxOption) => {
    labels.current.set(option.value, option.label);
    if (chosen.has(option.value)) {
      const next = values.filter((v) => v !== option.value);
      setValues(next);
      announce(messages.removed(option.label, next.length));
    } else {
      if (atMax) return announce(messages.max(max));
      const next = [...values, option.value];
      setValues(next);
      const reached = max !== undefined && next.length >= max ? ` ${messages.max(max)}` : "";
      announce(`${messages.added(option.label, next.length)}${reached}`);
    }
  };

  const commit = (index: number) => {
    const item = list.items[index];
    if (!item || item.disabled) return;
    if (item.kind === "option") toggle(item.option);
    else {
      const ids = enabledListed.map((o) => o.value);
      for (const o of enabledListed) labels.current.set(o.value, o.label);
      const next = allListedChosen ? values.filter((v) => !ids.includes(v)) : [...values, ...ids.filter((v) => !chosen.has(v))];
      setValues(next);
      announce(messages.summary(next.length));
    }
    // A fresh search for the next choice; the cursor stays on what was chosen.
    if (text !== "") setText("");
  };

  const removeAt = (index: number) => {
    const removed = values[index];
    if (removed === undefined || locked) return;
    const next = values.filter((_, i) => i !== index);
    setValues(next);
    announce(messages.removed(labelOf(removed), next.length));
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
    if (rootRef.current?.contains(event.relatedTarget as Node | null)) return;
    setOpen(false);
    if (text !== "") setText("");
  };

  const count = list.items.filter((item) => item.kind === "option").length;
  const status = !open || text === "" ? "" : loading ? messages.loading : (loadError ?? (count === 0 ? messages.empty : messages.results(count)));
  const many = values.length > 1;

  return (
    <div ref={rootRef} className={cn("relative @container w-full min-w-0", className)}>
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
            <SelectionToggle
              open={open}
              label={messages.toggle}
              controls={popup.present ? popup.listboxId : undefined}
              onToggle={() => {
                inputRef.current?.focus();
                setOpen(!open);
              }}
            />
          )
        }
        className={classNames?.frame}
      >
        <SelectionChips
          chips={values.map((v) => ({ key: v, label: labelOf(v) }))}
          label={messages.selected}
          removeLabel={messages.remove}
          onRemove={removeAt}
          inputRef={inputRef}
          disabled={field.disabled}
          readOnly={field.readOnly}
          // Narrow field: two or more chips fold into the summary below.
          className={cn(many && "@max-column-md:hidden")}
          chipClassName={classNames?.chip}
        />
        {many && (
          <span className="r-form-chip hidden pe-r5 font-medium @max-column-md:inline-flex">
            {messages.summary(values.length)}
          </span>
        )}
        <input
          ref={setInputRef}
          type="text"
          role="combobox"
          id={field.id}
          // Native validation sees an empty search; it may only stop the form while nothing is chosen.
          required={field.required && values.length === 0}
          aria-required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={popup.present ? popup.listboxId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? popup.optionId(activeIndex) : undefined}
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
        loadingMessage={messages.loading}
        error={loadError}
        emptyMessage={messages.empty}
        notice={atMax ? messages.max(max) : undefined}
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
