"use client";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentPropsWithRef,
  type FocusEvent,
  type KeyboardEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { ErrorLine } from "../../util/error-line";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldMessage, useFieldValue } from "./Field";
import {
  focusLastChip,
  focusLeaves,
  HiddenValues,
  SelectionChips,
  SelectionFrame,
  stringList,
  useAnnouncer,
} from "./selection-field";
import { foldText } from "../../util/text-match";
import { buildSelectionList, type ComboboxOption, SelectionListbox, useSelectionPopup } from "./selection-popup";
import { type LabelsProp, mergeLabels } from "../../util/labels";

/** Every string the control says, for localisation. */
export interface TagInputLabels {
  /** Names the chip list. */
  tags: string;
  remove: (tag: string) => string;
  added: (tags: string[], count: number) => string;
  removed: (tag: string, count: number) => string;
  duplicate: (tag: string) => string;
  max: (max: number) => string;
}

export const DEFAULT_TAG_INPUT_LABELS: TagInputLabels = {
  tags: "Tags",
  remove: (tag) => `Remove ${tag}`,
  added: (tags, count) => `Added ${tags.join(", ")}. ${count} ${count === 1 ? "tag" : "tags"}.`,
  removed: (tag, count) => `Removed ${tag}. ${count} ${count === 1 ? "tag" : "tags"}.`,
  duplicate: (tag) => `“${tag}” is already added.`,
  max: (max) => `Up to ${max} ${max === 1 ? "tag" : "tags"}.`,
};

export interface TagInputProps
  extends Omit<ComponentPropsWithRef<"input">, "value" | "defaultValue" | "type" | "size" | "children" | "name"> {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (tags: string[]) => void;
  /** The tag being typed. */
  inputValue?: string;
  defaultInputValue?: string;
  onInputChange?: (text: string) => void;
  /** Splits typed and pasted text into tags; Enter always commits. Flags are ignored. @default /[,;\n]/ */
  delimiter?: RegExp;
  /** A refusal message for a tag, or nothing to accept it. Shown under the field and announced. */
  validate?: (tag: string, tags: readonly string[]) => string | null | undefined;
  /** Compare tags with case and diacritics when refusing duplicates. @default false */
  caseSensitive?: boolean;
  max?: number;
  /** Offered in a list while typing; choosing one adds its `value`. */
  suggestions?: readonly (string | ComboboxOption)[];
  /** Commit the typed tag when focus leaves the field. @default true */
  commitOnBlur?: boolean;
  /** Submitted as one hidden input per tag. */
  name?: string;
  invalid?: boolean;
  labels?: LabelsProp<TagInputLabels>;
  /** `className` styles the root (width lands there); `ref` and the rest address the `<input>`. */
  classNames?: SlotClassNames<"frame" | "input" | "chip" | "message" | "listbox" | "option">;
}

/**
 * Free-form tags: type and press Enter or a delimiter (comma, semicolon, new
 * line), or paste a list. Each tag is trimmed, checked against the others
 * (no duplicates, ignoring case) and `validate`; a refused tag stays in the
 * field with its message under it. Backspace in an empty field removes the last
 * tag. With `suggestions`, a combobox list offers matching ones.
 */
export function TagInput({
  value: valueProp,
  defaultValue = [],
  onValueChange,
  inputValue: inputValueProp,
  defaultInputValue = "",
  onInputChange,
  delimiter = /[,;\n]/,
  validate,
  caseSensitive = false,
  max,
  suggestions,
  commitOnBlur = true,
  name,
  invalid: invalidProp,
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
  onPaste,
  onBlur,
  form,
  placeholder,
  ...props
}: TagInputProps) {
  const labels = mergeLabels(DEFAULT_TAG_INPUT_LABELS, labelsProp);
  const [refusal, setRefusal] = useState<string | null>(null);
  const messageId = useId();
  // A refused tag makes the Field invalid and joins its description.
  useFieldMessage("error", messageId, refusal !== null);
  const field = useFieldControl({
    id: idProp,
    invalid: refusal !== null ? true : invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": [describedByProp, refusal !== null ? messageId : undefined].filter(Boolean).join(" ") || undefined,
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
  const [tags, setTags, fieldName] = useFieldValue<string[]>({
    value: valueProp,
    defaultValue,
    onChange: onValueChange,
    fromForm: stringList,
  });
  const [text, setText] = useControllableState({ value: inputValueProp, defaultValue: defaultInputValue, onChange: onInputChange });
  const same = (a: string, b: string) => (caseSensitive ? a === b : foldText(a) === foldText(b));

  const options: ComboboxOption[] = (suggestions ?? []).map((s) => (typeof s === "string" ? { value: s, label: s } : s));
  const offered = options.filter((o) => !tags.some((t) => same(t, o.value)));
  const list = buildSelectionList(offered, { query: text });
  // Open only while something matches: an empty suggestion panel says nothing.
  const [wantOpen, setWantOpen] = useState(false);
  const popup = useSelectionPopup({ items: list.items, open: wantOpen && list.items.length > 0, onOpenChange: setWantOpen });
  const { open, setOpen, activeIndex, activeSource } = popup;
  const setReference = popup.floating.refs.setReference;
  const setFrameRef = useMemo(() => mergeRefs(frameRef, setReference), [setReference]);
  const hasList = suggestions !== undefined;

  /**
   * Commits each candidate in order and stops at the first refusal, which (with
   * everything after it) stays in the field as the draft. Returns the draft.
   */
  const commitAll = (candidates: string[]): string => {
    const next = [...tags];
    const added: string[] = [];
    let message: string | null = null;
    let index = 0;
    for (; index < candidates.length; index++) {
      const tag = (candidates[index] ?? "").trim();
      if (tag === "") continue;
      if (max !== undefined && next.length >= max) message = labels.max(max);
      else if (next.some((t) => same(t, tag))) message = labels.duplicate(tag);
      else message = validate?.(tag, next) || null;
      if (message) break;
      next.push(tag);
      added.push(tag);
    }
    if (added.length > 0) setTags(next);
    setRefusal(message);
    const spoken = [added.length > 0 ? labels.added(added, next.length) : "", message ?? ""].filter(Boolean).join(" ");
    if (spoken) announce(spoken);
    return candidates
      .slice(index)
      .map((c) => c.trim())
      .filter(Boolean)
      .join(", ");
  };

  // Without `g` / `y`: a sticky pattern only matches at the start, and either flag makes `test` stateful.
  const splitter = new RegExp(delimiter.source, delimiter.flags.replace(/[gy]/g, ""));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (refusal !== null) setRefusal(null);
    if (!splitter.test(raw)) {
      setText(raw);
      if (hasList && !locked) {
        setWantOpen(raw.trim() !== "");
        popup.clearActive();
      }
      return;
    }
    // A delimiter typed (or dropped in): everything before the last one commits.
    const parts = raw.split(splitter);
    const trailing = parts.pop() ?? "";
    setText([commitAll(parts), trailing.trimStart()].filter(Boolean).join(", "));
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!splitter.test(pasted)) return;
    event.preventDefault();
    const input = event.currentTarget;
    const before = text.slice(0, input.selectionStart ?? text.length);
    const after = text.slice(input.selectionEnd ?? text.length);
    const parts = `${before}${pasted}${after}`.split(splitter);
    // Whatever follows the last delimiter (the paste's tail, or text after the caret) stays as the draft.
    const trailing = parts.pop() ?? "";
    const left = commitAll(parts);
    setText([left, trailing].filter(Boolean).join(", "));
  };

  const commitDraft = () => {
    if (text.trim() === "") return;
    setText(commitAll([text]));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (locked) return;
    if (hasList && popup.navigate(event, { canOpen: offered.length > 0 })) return;
    if (focusLastChip(event, frameRef.current)) return;
    switch (event.key) {
      case "Enter": {
        const item = list.items[activeIndex];
        // Only an option the arrows reached: a hovered one is not a choice.
        if (open && item?.kind === "option" && activeSource === "keyboard") {
          event.preventDefault();
          setText(commitAll([item.option.value]));
          setOpen(false);
          return;
        }
        if (text.trim() !== "") {
          // A draft is committed, never submitted.
          event.preventDefault();
          commitDraft();
          setOpen(false);
        }
        return;
      }
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case "Backspace":
        if (text === "" && tags.length > 0 && event.currentTarget.selectionStart === 0) {
          event.preventDefault();
          removeAt(tags.length - 1);
        }
        return;
    }
  };

  const removeAt = (index: number) => {
    const removed = tags[index];
    if (removed === undefined || locked) return;
    const next = tags.filter((_, i) => i !== index);
    setTags(next);
    setRefusal(null);
    announce(labels.removed(removed, next.length));
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (!focusLeaves(rootRef.current, event)) return;
    setOpen(false);
    if (commitOnBlur && !locked) commitDraft();
  };

  return (
    <div ref={rootRef} className={cn("relative grid w-full min-w-0 gap-r5", className)}>
      <SelectionFrame
        frameRef={setFrameRef}
        inputRef={inputRef}
        invalid={field.invalid}
        disabled={field.disabled}
        readOnly={field.readOnly}
        chips
        className={classNames?.frame}
      >
        <SelectionChips
          chips={tags.map((tag) => ({ key: tag, label: tag }))}
          label={labels.tags}
          removeLabel={labels.remove}
          onRemove={removeAt}
          inputRef={inputRef}
          disabled={field.disabled}
          readOnly={field.readOnly}
          chipClassName={classNames?.chip}
        />
        <input
          ref={setInputRef}
          type="text"
          // Without suggestions there is no list: a plain text input.
          {...(hasList ? popup.comboboxProps : { autoComplete: "off" })}
          id={field.id}
          required={field.required && tags.length === 0}
          aria-required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          {...field.ariaProps}
          form={form}
          placeholder={tags.length === 0 ? placeholder : undefined}
          {...props}
          value={text}
          onChange={composeEventHandlers(onChange, handleChange)}
          onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
          onPaste={composeEventHandlers(onPaste, handlePaste)}
          onBlur={composeEventHandlers(onBlur, handleBlur)}
          className={cn("r-form-input r-form-chip-input min-w-0 bg-transparent text-body-1 text-fg-primary", classNames?.input)}
        />
      </SelectionFrame>
      {refusal !== null && (
        <ErrorLine id={messageId} className={classNames?.message}>
          {refusal}
        </ErrorLine>
      )}
      {hasList && (
        <SelectionListbox
          popup={popup}
          list={list}
          isSelected={() => false}
          query={text}
          onCommit={(index) => {
            const item = list.items[index];
            if (item?.kind === "option") setText(commitAll([item.option.value]));
            setOpen(false);
            inputRef.current?.focus();
          }}
          labelledBy={field.labelId}
          label={props["aria-label"]}
          loadingMessage=""
          emptyMessage={null}
          virtualizeThreshold={100}
          className={classNames?.listbox}
          optionClassName={classNames?.option}
        />
      )}
      <HiddenValues name={name ?? fieldName} values={tags} form={form} />
      {region}
    </div>
  );
}
