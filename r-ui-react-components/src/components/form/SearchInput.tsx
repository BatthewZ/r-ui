"use client";
import { LoaderCircle, Search, X } from "lucide-react";
import { type ChangeEvent, type KeyboardEvent, useRef } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";

import { useField } from "./Field";
import { Input, type InputProps } from "./Input";

export interface SearchInputProps extends Omit<InputProps, "type" | "value" | "defaultValue" | "start"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called after the clear button or Escape empties the field. */
  onClear?: () => void;
  /** Accessible name of the clear button. */
  clearLabel?: string;
  /** Results are on their way: the magnifier becomes a spinner and the field `aria-busy`. */
  loading?: boolean;
}

/**
 * A search field: magnifier, a clear button while there is text, and Escape
 * to clear. An Escape that clears nothing is left to reach the dialog or
 * palette around the field. Named "Search" unless a label or `aria-label` names it.
 */
export function SearchInput({
  value,
  defaultValue = "",
  onValueChange,
  onClear,
  clearLabel = "Clear search",
  loading = false,
  placeholder = "Search",
  onChange,
  onKeyDown,
  ref,
  end,
  ...props
}: SearchInputProps) {
  const field = useField();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useControllableState({ value, defaultValue, onChange: onValueChange });
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
      aria-label={named ? undefined : "Search"}
      aria-busy={loading || undefined}
      placeholder={placeholder}
      {...props}
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
            <button type="button" aria-label={clearLabel} onClick={clear} className="r-form-icon-button hit-area">
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
