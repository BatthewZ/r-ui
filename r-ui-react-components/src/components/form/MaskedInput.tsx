"use client";
import {
  type ChangeEvent,
  type CompositionEvent,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";

import { useFieldValue } from "./Field";
import { Input, type InputProps } from "./Input";
import {
  applyMaskEdit,
  DEFAULT_MASK_TOKENS,
  fitChars,
  formatMask,
  isNumericMask,
  maskPlaceholder,
  type MaskTokens,
  parseMask,
  slotCount,
} from "./mask-core";

export interface MaskedInputProps extends Omit<InputProps, "type" | "value" | "defaultValue"> {
  /**
   * The pattern: `9` a digit, `A` a letter, `*` a letter or digit, anything
   * else a literal shown as it is (`\9` is a literal 9). `"(999) 999-9999"`,
   * `"99/99"`, `"AAA-9999"`.
   */
  mask: string;
  /** More slot characters, or other meanings for the defaults (`{ h: { test: (c) => /[0-9a-f]/i.test(c) } }`). */
  tokens?: MaskTokens;
  /** The RAW value: the slot characters only ("5551234567"). */
  value?: string;
  defaultValue?: string;
  /** Every edit: the raw value and the text shown for it. */
  onValueChange?: (raw: string, formatted: string) => void;
  /** Once the last slot is filled. */
  onComplete?: (raw: string, formatted: string) => void;
  /** Draws each empty slot in the default placeholder (`"(___) ___-____"`). A `placeholder` replaces it. @default "_" */
  placeholderChar?: string;
  /** `tel` brings the phone keypad on touch devices. @default "text" */
  type?: "text" | "tel";
}

interface Base {
  raw: string;
  shown: string;
}

/**
 * A text field that follows a pattern (a phone number, a card expiry, a
 * plate). Literals appear as the value reaches them; typing, deleting,
 * pasting and replacing a selection anywhere in the text keep the caret where
 * the edit happened, and a character a slot refuses is dropped (a paste of
 * "(555) 123-4567" keeps its digits). Backspace over a literal deletes the
 * character before it. The value is RAW (slot characters only):
 * `onValueChange(raw, formatted)`, and inside a bound Field the form holds the
 * raw text; `name` submits it from a hidden input. An all-digit mask asks for
 * the number pad (`inputMode`) and stays left to right in an RTL page, and IME
 * composition is left alone until it commits. `ref` and the other props address the visible `<input>`.
 */
export function MaskedInput({
  mask,
  tokens,
  value,
  defaultValue = "",
  onValueChange,
  onComplete,
  placeholderChar = "_",
  placeholder,
  inputMode,
  type = "text",
  name,
  form,
  ref,
  onChange,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: MaskedInputProps) {
  const parts = useMemo(() => parseMask(mask, tokens ? { ...DEFAULT_MASK_TOKENS, ...tokens } : DEFAULT_MASK_TOKENS), [mask, tokens]);
  const [stored, setRaw, fieldName] = useFieldValue<string>({
    value,
    defaultValue,
    onChange: (next) => onValueChange?.(next, formatMask(parts, next)),
    fromForm: (raw) => (typeof raw === "string" ? raw : ""),
  });
  // A value from outside (a caller, the form, a default) is fitted like typed text.
  const raw = fitChars(parts, stored);
  // While an IME composes, the field shows what it composes, untouched.
  const [composing, setComposing] = useState<string | null>(null);
  const shown = composing ?? formatMask(parts, raw);
  const numeric = isNumericMask(parts);

  const inputRef = useRef<HTMLInputElement>(null);
  const setInputRef = useMemo(() => mergeRefs(ref, inputRef), [ref]);
  const latest = useRef<Base>({ raw, shown });
  latest.current = { raw, shown };
  const compositionBase = useRef<Base | null>(null);
  const pendingCaret = useRef<number | null>(null);
  // A refused edit leaves the value as it was, and React then restores the
  // input's text, which throws the caret to the end: a render puts it back.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    const input = inputRef.current;
    if (caret === null || !input) return;
    pendingCaret.current = null;
    if (input.ownerDocument.activeElement === input) input.setSelectionRange(caret, caret);
  });

  const edit = (base: Base, next: string, caret: number, forward: boolean) => {
    const result = applyMaskEdit(parts, { raw: base.raw, shown: base.shown, next, caret, forward });
    pendingCaret.current = result.caret;
    if (result.raw !== raw) {
      setRaw(result.raw);
      const slots = slotCount(parts);
      if (slots > 0 && Array.from(result.raw).length === slots && Array.from(raw).length < slots) {
        onComplete?.(result.raw, formatMask(parts, result.raw));
      }
    }
    rerender();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    if (compositionBase.current) {
      setComposing(input.value);
      return;
    }
    const caret = input.selectionStart ?? input.value.length;
    const inputType = (event.nativeEvent as Partial<InputEvent>).inputType ?? "";
    edit(latest.current, input.value, caret, inputType.endsWith("Forward"));
  };

  return (
    <>
      <Input
        ref={setInputRef}
        {...props}
        type={type}
        form={form}
        value={shown}
        placeholder={placeholder ?? maskPlaceholder(parts, placeholderChar)}
        inputMode={inputMode ?? (numeric ? "numeric" : "text")}
        // A number with its punctuation reads left to right in a right-to-left page, as it is written.
        dir={props.dir ?? (numeric ? "ltr" : undefined)}
        onChange={composeEventHandlers(onChange, handleChange)}
        onCompositionStart={composeEventHandlers(onCompositionStart, (event: CompositionEvent<HTMLInputElement>) => {
          compositionBase.current = latest.current;
          setComposing(event.currentTarget.value);
        })}
        onCompositionEnd={composeEventHandlers(onCompositionEnd, (event: CompositionEvent<HTMLInputElement>) => {
          const base = compositionBase.current;
          compositionBase.current = null;
          setComposing(null);
          if (!base) return;
          const input = event.currentTarget;
          edit(base, input.value, input.selectionStart ?? input.value.length, false);
        })}
      />
      {(name ?? fieldName) && <input type="hidden" name={name ?? fieldName} value={raw} form={form} />}
    </>
  );
}
