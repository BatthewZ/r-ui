"use client";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type ComponentPropsWithRef,
  Fragment,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";
import { type LabelsProp, useLabels } from "../../util/locale";

export type OTPInputMode = "numeric" | "alphanumeric";

/** Every string the control says, for localisation. */
export interface OTPInputLabels {
  /** The name when neither a Field label, `aria-label` nor `aria-labelledby` gives one. */
  label: string;
  /**
   * Read right after the name, which it joins (aria-labelledby): ", 6 digits".
   * Keep the leading punctuation, so a screen reader pauses between the two.
   */
  length: (length: number, mode: OTPInputMode) => string;
}

export const DEFAULT_OTP_INPUT_LABELS: OTPInputLabels = {
  label: "Verification code",
  length: (length, mode) => `, ${length} ${mode === "numeric" ? "digits" : "characters"}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    OTPInput: OTPInputLabels;
  }
}

const ALLOWED: Record<OTPInputMode, RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[A-Za-z0-9]/,
};

/** Only the characters the mode allows: a pasted "123-456" or "123 456" is "123456". */
function keep(text: string, mode: OTPInputMode): string {
  let out = "";
  for (const char of text) if (ALLOWED[mode].test(char)) out += char;
  return out;
}

export interface OTPInputProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    "value" | "defaultValue" | "type" | "size" | "maxLength" | "minLength" | "inputMode" | "pattern" | "children"
  > {
  /** How many characters the code has. @default 6 */
  length?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (code: string) => void;
  /** Called once per complete code (typed, pasted or autofilled); the same code again does not repeat it. */
  onComplete?: (code: string) => void;
  /** `numeric` keeps 0–9 and opens the number pad; `alphanumeric` keeps A–Z, a–z, 0–9. @default "numeric" */
  mode?: OTPInputMode;
  /** Shows a dot in each filled box and makes the input a password field. */
  mask?: boolean;
  /**
   * Sizes of the visual groups, e.g. `[3, 3]` shows "123 456". They must add up to
   * `length`; otherwise the boxes are not grouped. The value never holds a separator.
   */
  groups?: readonly number[];
  /** Drawn between groups. @default a short dash */
  separator?: ReactNode;
  invalid?: boolean;
  labels?: LabelsProp<OTPInputLabels>;
  /** `className` styles the root; `ref` and every other prop address the `<input>`. */
  classNames?: SlotClassNames<"input" | "box" | "separator">;
}

/**
 * A one-time code as ONE field: a single real `<input>` (one accessible name,
 * "Verification code, 6 digits"; `autocomplete="one-time-code"` autofill; native
 * editing for a screen reader) lies over a row of boxes that only draw it.
 * Typing advances, Backspace goes back, the arrows, Home and End move, a filled
 * box is selected so typing replaces it, and a paste (or an autofill) keeps only
 * the allowed characters and fills every box. The boxes stay left-to-right in a
 * right-to-left page. Binds to a `Form` through `Field name`.
 */
export function OTPInput({
  length = 6,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onComplete,
  mode = "numeric",
  mask = false,
  groups,
  separator,
  invalid: invalidProp,
  labels: labelsProp,
  name,
  className,
  classNames,
  ref,
  id: idProp,
  required: requiredProp,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  onChange,
  onKeyDown,
  onPaste,
  onFocus,
  onBlur,
  onSelect,
  onPointerDown,
  onPointerUp,
  ...props
}: OTPInputProps) {
  const labels = useLabels("OTPInput", DEFAULT_OTP_INPUT_LABELS, labelsProp);
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  const [stored, setValue, fieldName] = useFieldValue<string>({
    value: valueProp,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "string" ? raw : ""),
  });
  const code = keep(stored, mode).slice(0, length);

  const inputRef = useRef<HTMLInputElement>(null);
  const setInputRef = useMemo(() => mergeRefs(ref, inputRef), [ref]);
  const boxesRef = useRef<HTMLDivElement>(null);
  // The boxes the selection covers while focused (`[start, end)`, one box for a
  // bare caret); `null` while not focused.
  const [selection, setSelection] = useState<readonly [number, number] | null>(null);
  // Where the caret goes once React has written the new value (which moves it to the end).
  const pendingCaret = useRef<number | null>(null);
  const [, rerender] = useState(0);
  const completed = useRef<string | null>(null);
  const pointerDown = useRef(false);

  const id = useId();
  const nameId = `${id}-name`;
  const countId = `${id}-count`;
  // One name: a label (the caller's, else the Field's, else ours), then the length.
  const ownName = ariaLabelledBy === undefined && (ariaLabel !== undefined || field.labelId === undefined);
  const labelledBy = [ariaLabelledBy ?? (ownName ? nameId : field.labelId), countId].join(" ");

  /**
   * Puts the caret on box `index`: a filled box is selected (typing replaces it),
   * the first empty one gets a bare caret. Never past the last box.
   */
  const place = (index: number, filled = code.length) => {
    const input = inputRef.current;
    if (!input) return;
    const at = Math.max(0, Math.min(index, filled, length - 1));
    if (at < filled) input.setSelectionRange(at, at + 1);
    else input.setSelectionRange(filled, filled);
    setSelection([at, at + 1]);
  };

  const commit = (next: string, caret: number) => {
    pendingCaret.current = caret;
    setValue(next);
    // Always re-render: a refused character leaves the value as it was, and React
    // then restores the input's text, which throws the caret to the end.
    rerender((n) => n + 1);
    if (next.length < length) {
      completed.current = null;
    } else if (completed.current !== next) {
      completed.current = next;
      onComplete?.(next);
    }
  };

  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    if (document.activeElement === inputRef.current) place(caret);
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const next = keep(raw, mode).slice(0, length);
    // The caret's place in the kept text: count what survives before it.
    const caret = keep(raw.slice(0, event.target.selectionStart ?? raw.length), mode).length;
    commit(next, caret);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (field.readOnly) return;
    const pasted = keep(event.clipboardData.getData("text"), mode);
    if (pasted === "") return;
    // A whole code replaces whatever is there; a fragment goes in at the caret.
    if (pasted.length >= length) {
      commit(pasted.slice(0, length), length);
      return;
    }
    const input = event.currentTarget;
    const start = Math.min(input.selectionStart ?? code.length, code.length);
    const end = Math.max(start, Math.min(input.selectionEnd ?? start, code.length));
    const next = (code.slice(0, start) + pasted + code.slice(end)).slice(0, length);
    commit(next, start + pasted.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    // A refused character never reaches the input, so it cannot replace a selected box.
    if (event.key.length === 1 && !ALLOWED[mode].test(event.key)) {
      event.preventDefault();
      return;
    }
    const from = selection?.[0] ?? 0;
    const moves: Partial<Record<string, number>> = {
      ArrowLeft: from - 1,
      ArrowRight: from + 1,
      ArrowUp: from,
      ArrowDown: from,
      Home: 0,
      End: code.length,
    };
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    place(to);
  };

  // Any other way the selection moves (a screen reader's caret, a long press): back onto a box.
  const handleSelect = () => {
    const input = inputRef.current;
    if (!input || document.activeElement !== input || pendingCaret.current !== null) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    // A wider selection (select all) is the user's; leave it.
    if (end - start > 1) {
      setSelection([start, Math.min(end, length)]);
      return;
    }
    const at = Math.min(start, code.length, length - 1);
    const wantEnd = at < code.length ? at + 1 : at;
    if (start !== at || end !== wantEnd) place(at);
    else setSelection([at, at + 1]);
  };

  // The input's own text is invisible and does not line up with the boxes: a press picks the box under it.
  const handlePointerUp = (event: PointerEvent<HTMLInputElement>) => {
    pointerDown.current = false;
    const boxes = boxesRef.current?.querySelectorAll<HTMLElement>("[data-otp-box]") ?? [];
    let nearest = 0;
    let best = Infinity;
    boxes.forEach((box, index) => {
      const rect = box.getBoundingClientRect();
      const distance = Math.abs(event.clientX - (rect.left + rect.right) / 2);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    place(nearest);
  };

  const handleFocus = () => {
    if (pointerDown.current) return;
    // Arriving by keyboard (the browser may select all): the first empty box, or the last when full.
    requestAnimationFrame(() => {
      if (document.activeElement === inputRef.current && !pointerDown.current) place(code.length);
    });
  };

  const groupEnds = new Set<number>();
  if (groups && groups.length > 1 && groups.every((g) => g > 0) && groups.reduce((a, b) => a + b, 0) === length) {
    let sum = 0;
    for (const size of groups.slice(0, -1)) groupEnds.add((sum += size) - 1);
  }

  return (
    // The row sits at the page's start (right, in a right-to-left page), but runs
    // left to right inside: a code is read left to right in every script.
    <div
      className={cn("r-form-otp relative inline-flex max-w-full justify-self-start", className)}
      data-invalid={field.invalid ? "" : undefined}
      data-disabled={field.disabled ? "" : undefined}
      data-readonly={field.readOnly ? "" : undefined}
    >
      <div ref={boxesRef} dir="ltr" aria-hidden className="flex min-w-0 items-center gap-r5">
        {Array.from({ length }, (_, index) => {
          const char = code[index];
          const isActive = selection !== null && index >= selection[0] && index < selection[1];
          return (
            <Fragment key={index}>
              <div
                data-otp-box=""
                data-active={isActive ? "" : undefined}
                data-filled={char !== undefined ? "" : undefined}
                className={cn("r-form-otp-box", classNames?.box)}
              >
                {char === undefined ? null : mask ? "•" : char}
              </div>
              {groupEnds.has(index) && (
                <div className={cn("r-form-otp-separator", classNames?.separator)}>{separator ?? "–"}</div>
              )}
            </Fragment>
          );
        })}
      </div>
      <input
        ref={setInputRef}
        dir="ltr"
        type={mask ? "password" : "text"}
        inputMode={mode === "numeric" ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoCapitalize={mode === "alphanumeric" ? "characters" : "off"}
        autoCorrect="off"
        spellCheck={false}
        id={field.id}
        name={name ?? fieldName}
        required={field.required}
        disabled={field.disabled}
        readOnly={field.readOnly}
        minLength={length}
        aria-labelledby={labelledBy}
        {...field.ariaProps}
        {...props}
        value={code}
        onChange={composeEventHandlers(onChange, handleChange)}
        onPaste={composeEventHandlers(onPaste, handlePaste)}
        onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
        onSelect={composeEventHandlers(onSelect, (event: SyntheticEvent<HTMLInputElement>) => {
          if (event.currentTarget === inputRef.current) handleSelect();
        })}
        onPointerDown={composeEventHandlers(onPointerDown, () => {
          pointerDown.current = true;
        })}
        onPointerUp={composeEventHandlers(onPointerUp, handlePointerUp)}
        onFocus={composeEventHandlers(onFocus, handleFocus)}
        onBlur={composeEventHandlers(onBlur, () => setSelection(null))}
        className={cn("r-form-otp-input", classNames?.input)}
      />
      {ownName && (
        <span id={nameId} hidden>
          {ariaLabel ?? labels.label}
        </span>
      )}
      <span id={countId} hidden>
        {labels.length(length, mode)}
      </span>
    </div>
  );
}
