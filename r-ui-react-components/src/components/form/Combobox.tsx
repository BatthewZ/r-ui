"use client";
import { Plus, X } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";
import { HiddenValues, keepFocus, SelectionFrame, SelectionToggle } from "./selection-field";
import { foldText } from "./selection-filter";
import {
  buildSelectionList,
  type ComboboxFilter,
  type ComboboxOption,
  type SelectionItem,
  SelectionListbox,
  useSelectionPopup,
} from "./selection-popup";

/** Why the text in the field changed. Async callers fetch on `"input"` only. */
export type ComboboxInputChangeReason = "input" | "select" | "reset" | "clear";

/** Every string the control says, for localisation. */
export interface ComboboxMessages {
  loading: string;
  empty: string;
  /** Announced while typing. */
  results: (count: number) => string;
  /** The free-text row. */
  custom: (text: string) => ReactNode;
  toggle: string;
  clear: string;
}

const MESSAGES: ComboboxMessages = {
  loading: "Loading…",
  empty: "No results",
  results: (count) => (count === 1 ? "1 result" : `${count} results`),
  custom: (text) => <>Use “{text}”</>,
  toggle: "Show options",
  clear: "Clear",
};

export interface ComboboxProps
  extends Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue" | "type" | "size" | "children" | "name"> {
  options: readonly ComboboxOption[];
  /** The chosen option's `value` (or, with `allowCustomValue`, any text). `null`: nothing chosen. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, option: ComboboxOption | null) => void;
  /** The text in the field. Controlled for async search; the reason says why it moved. */
  inputValue?: string;
  defaultInputValue?: string;
  onInputChange?: (text: string, reason: ComboboxInputChangeReason) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Default: contains, ignoring case and diacritics. `false`: show `options` as given (the caller filters). */
  filter?: ComboboxFilter | false;
  /** Results are on their way: a loading row, and `aria-busy` on the list. */
  loading?: boolean;
  /** Loading failed: shown in place of the options. */
  loadError?: string;
  /** Accept typed text that matches no option ("Use “abc”"). */
  allowCustomValue?: boolean;
  /** Submitted through a hidden input holding `value`. */
  name?: string;
  invalid?: boolean;
  /** Leading adornment (a search icon). */
  start?: ReactNode;
  /** Lists longer than this are windowed. @default 100 */
  virtualizeThreshold?: number;
  messages?: Partial<ComboboxMessages>;
  /** `className` styles the root (width lands there); `ref` and the rest address the `<input>`. */
  classNames?: SlotClassNames<"frame" | "input" | "listbox" | "option">;
}

/**
 * An editable combobox with a listbox popup (WAI-ARIA APG): type to filter,
 * arrows / Home / End to move, Enter or Tab to choose, Escape to close (and
 * revert the text), Escape again to clear. DOM focus stays in the input; the
 * highlighted option is `aria-activedescendant`. Typing highlights the first
 * match, so Enter and Tab take it. On blur, typed text that is not a choice
 * reverts to the current one, unless `allowCustomValue`.
 */
export function Combobox({
  options,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  inputValue: inputValueProp,
  defaultInputValue,
  onInputChange,
  open: openProp,
  defaultOpen,
  onOpenChange,
  filter,
  loading = false,
  loadError,
  allowCustomValue = false,
  name,
  invalid: invalidProp,
  start,
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
  ...props
}: ComboboxProps) {
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

  // The label of every option ever chosen: async results move on, the field keeps its text.
  const labels = useRef(new Map<string, string>());
  const optionFor = (v: string | null) => (v === null ? null : (options.find((o) => o.value === v) ?? null));
  // Inside a Field bound to a Form (and with no `value`), the form owns the value.
  const [value, setValue, fieldName] = useFieldValue<string | null>({
    value: valueProp,
    defaultValue,
    onChange: (next) => onValueChange?.(next, optionFor(next)),
    fromForm: (v) => (typeof v === "string" && v !== "" ? v : null),
  });
  const labelOf = (v: string | null) =>
    v === null ? "" : (optionFor(v)?.label ?? labels.current.get(v) ?? v);

  // `editing`: the text is the user's own, so it filters. Otherwise the field
  // shows the chosen label and the list shows everything.
  const [editing, setEditing] = useState(defaultInputValue !== undefined);
  const [draft, setDraft] = useState(defaultInputValue ?? "");
  const text = inputValueProp ?? (editing ? draft : labelOf(value));
  const query = editing ? text : "";

  const setText = (next: string, reason: ComboboxInputChangeReason, nextEditing: boolean) => {
    setEditing(nextEditing);
    setDraft(next);
    if (next !== text) onInputChange?.(next, reason);
  };

  const trimmed = text.trim();
  const offerCustom =
    allowCustomValue && editing && trimmed !== "" && !options.some((o) => foldText(o.label) === foldText(trimmed));
  const top: SelectionItem[] = offerCustom
    ? [{ kind: "action", key: "custom", label: messages.custom(trimmed), icon: <Plus />, disabled: false }]
    : [];
  const list = buildSelectionList(options, { query, filter, top });
  const popup = useSelectionPopup({ items: list.items, open: openProp, defaultOpen, onOpenChange });
  const { open, setOpen, activeIndex, activeSource } = popup;
  const selectedIndex = list.items.findIndex((item) => item.kind === "option" && item.option.value === value);

  const choose = (next: string | null, label: string) => {
    if (next !== null) labels.current.set(next, label);
    setValue(next);
    setText(label, next === null ? "clear" : "select", false);
  };

  const commit = (index: number) => {
    const item = list.items[index];
    if (!item || item.disabled) return;
    if (item.kind === "option") choose(item.option.value, item.option.label);
    else choose(trimmed, trimmed);
    setOpen(false);
  };

  /** Settle typed text that was not chosen from the list. */
  const settle = () => {
    if (!editing) return;
    if (trimmed === "") return choose(null, "");
    const exact = options.find((o) => !o.disabled && foldText(o.label) === foldText(trimmed));
    if (exact) return choose(exact.value, exact.label);
    if (allowCustomValue) return choose(trimmed, trimmed);
    setText(labelOf(value), "reset", false);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value, "input", true);
    if (locked) return;
    if (!open) setOpen(true);
    popup.activateFirst();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (locked) return;
    if (popup.navigate(event, { selectedIndex })) return;
    switch (event.key) {
      case "Enter":
        if (open && activeIndex >= 0) {
          event.preventDefault();
          commit(activeIndex);
        } else if (open) {
          // Nothing highlighted: never submit the form from an open list.
          event.preventDefault();
          settle();
          setOpen(false);
        } else settle();
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          if (editing) setText(labelOf(value), "reset", false);
        } else if (text !== "" || value !== null) {
          event.preventDefault();
          choose(null, "");
        }
        return;
      case "Tab":
        // The keyboard's highlight is taken; a hover is not a choice.
        if (open && activeIndex >= 0 && activeSource !== "pointer") commit(activeIndex);
        return;
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (rootRef.current?.contains(event.relatedTarget as Node | null)) return;
    setOpen(false);
    settle();
  };

  // Spoken while typing: the eye sees the list change, the ear needs the count.
  const count = list.items.filter((item) => item.kind === "option").length;
  const status =
    !open || !editing ? "" : loading ? messages.loading : (loadError ?? (count === 0 ? messages.empty : messages.results(count)));

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-0", className)}>
      <SelectionFrame
        frameRef={popup.floating.refs.setReference}
        inputRef={inputRef}
        invalid={field.invalid}
        disabled={field.disabled}
        readOnly={field.readOnly}
        onPress={() => setOpen(true)}
        start={start}
        end={
          locked ? undefined : (
            <>
              {text !== "" && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={messages.clear}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    choose(null, "");
                    inputRef.current?.focus();
                  }}
                  className="r-form-icon-button hit-area"
                >
                  <X aria-hidden />
                </button>
              )}
              <SelectionToggle
                open={open}
                label={messages.toggle}
                controls={popup.present ? popup.listboxId : undefined}
                onToggle={() => {
                  inputRef.current?.focus();
                  setOpen(!open);
                }}
              />
            </>
          )
        }
        className={classNames?.frame}
      >
        <input
          ref={setInputRef}
          type="text"
          role="combobox"
          id={field.id}
          required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          // The listbox renders nothing while closed: an IDREF must not dangle.
          aria-controls={popup.present ? popup.listboxId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? popup.optionId(activeIndex) : undefined}
          {...field.ariaProps}
          form={form}
          {...props}
          value={text}
          onChange={composeEventHandlers(onChange, handleChange)}
          onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
          onClick={composeEventHandlers(onClick, () => {
            if (!locked && !open) setOpen(true);
          })}
          onBlur={composeEventHandlers(onBlur, handleBlur)}
          className={cn(
            "r-form-input min-w-0 flex-1 self-stretch bg-transparent text-body-1 text-fg-primary",
            classNames?.input,
          )}
        />
      </SelectionFrame>
      <SelectionListbox
        popup={popup}
        list={list}
        isSelected={(item) => item.kind === "option" && item.option.value === value}
        query={query}
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
        virtualizeThreshold={virtualizeThreshold}
        className={classNames?.listbox}
        optionClassName={classNames?.option}
      />
      <HiddenValues name={name ?? fieldName} values={[value ?? ""]} form={form} />
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}
