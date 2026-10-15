"use client";
import { LoaderCircle, Search, X } from "lucide-react";
import { type ChangeEvent, type KeyboardEvent, useRef } from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";

import { useField, useFieldValue } from "./Field";
import { Input, type InputProps } from "./Input";
import { type LabelsProp, mergeLabels } from "../../util/labels";

export interface SearchInputProps extends Omit<InputProps, "type" | "value" | "defaultValue" | "start"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called after the clear button or Escape empties the field. */
  onClear?: () => void;
  /** Results are on their way: the magnifier becomes a spinner and the field `aria-busy`. */
  loading?: boolean;
  labels?: LabelsProp<SearchInputLabels>;
}

/** Every string the control says, for localisation. */
export interface SearchInputLabels {
  /** The field's name when nothing else names it, and its default placeholder. */
  search: string;
  /** The clear button's name. */
  clear: string;
}

export const DEFAULT_SEARCH_INPUT_LABELS: SearchInputLabels = {
  search: "Search",
  clear: "Clear search",
};

/**
 * A search field: magnifier, a clear button while there is text, and Escape
 * to clear. An Escape that clears nothing is left to reach the dialog or
 * palette around the field. Named `labels.search` unless a label or `aria-label` names it.
 */
export function SearchInput({
  value,
  defaultValue = "",
  onValueChange,
  onClear,
  loading = false,
  labels: labelsProp,
  placeholder: placeholderProp,
  onChange,
  onKeyDown,
  ref,
  end,
  ...props
}: SearchInputProps) {
  const labels = mergeLabels(DEFAULT_SEARCH_INPUT_LABELS, labelsProp);
  const placeholder = placeholderProp ?? labels.search;
  const field = useField();
  const inputRef = useRef<HTMLInputElement>(null);
  // In a Field bound to a Form, the form owns the text (unless the caller passed `value`).
  const [text, setText, fieldName] = useFieldValue({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "string" ? raw : ""),
  });
  const locked =
    (props.disabled ?? field?.disabled) === true || (props.readOnly ?? field?.readOnly) === true;
  // A default name would outrank a visible `<label for>`, so it stands aside
  // for any sign the caller names the field.
  const named =
    props["aria-label"] !== undefined ||
    props["aria-labelledby"] !== undefined ||
    props.id !== undefined ||
    field?.labelId !== undefined;

  const clear = () => {
    if (locked) return;
    setText("");
    onClear?.();
    // The button unmounts with the text; keep focus in the field (WCAG 2.4.3).
    inputRef.current?.focus();
  };

  const handleKeyDown = composeEventHandlers(onKeyDown, (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape" || locked || text === "") return;
    event.preventDefault();
    event.stopPropagation();
    clear();
  });

  const Icon = loading ? LoaderCircle : Search;

  return (
    <Input
      ref={mergeRefs(ref, inputRef)}
      type="search"
      aria-label={named ? undefined : labels.search}
      aria-busy={loading || undefined}
      placeholder={placeholder}
      {...props}
      name={props.name ?? fieldName}
      value={text}
      onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) =>
        setText(event.target.value),
      )}
      onKeyDown={handleKeyDown}
      classNames={{ ...props.classNames, input: cn("r-form-search", props.classNames?.input) }}
      start={<Icon aria-hidden className={loading ? "animate-spin" : undefined} />}
      end={
        text !== "" && !locked ? (
          <>
            <button type="button" aria-label={labels.clear} onClick={clear} className="r-form-icon-button hit-area">
              <X aria-hidden />
            </button>
            {end}
          </>
        ) : (
          end
        )
      }
    />
  );
}
