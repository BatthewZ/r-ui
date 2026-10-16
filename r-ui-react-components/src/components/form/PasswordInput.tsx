"use client";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { type Tone, TONE_TEXT } from "../../util/tone";
import { IconButton } from "../primitives";

import { useField, useFieldValue } from "./Field";
import { Input, type InputProps, keepFocus } from "./Input";
import {
  DEFAULT_PASSWORD_STRENGTH_LABELS,
  estimatePasswordStrength,
  type PasswordStrength,
  type PasswordStrengthEstimator,
  type PasswordStrengthLabels,
} from "./password-strength";
import { useAnnouncer } from "./selection-field";

/** Every string the control says, for localisation; the built-in estimator's words included. */
export interface PasswordInputLabels extends PasswordStrengthLabels {
  /** The show/hide toggle's name. It stays the same; `aria-pressed` says whether the password shows. */
  show: string;
  /** Names the strength meter. */
  strength: string;
  /** Shown (and described) while Caps Lock is on in the field. */
  capsLock: string;
}

export const DEFAULT_PASSWORD_INPUT_LABELS: PasswordInputLabels = {
  ...DEFAULT_PASSWORD_STRENGTH_LABELS,
  show: "Show password",
  strength: "Password strength",
  capsLock: "Caps Lock is on.",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    PasswordInput: PasswordInputLabels;
  }
}

export interface PasswordInputProps extends Omit<InputProps, "type" | "value" | "defaultValue" | "classNames" | "autoComplete"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * `current-password` (default: a sign-in) or `new-password` (a sign-up or a
   * change, where a password manager offers to generate one).
   */
  autoComplete?: "current-password" | "new-password" | "one-time-code" | "off";
  /** Shows the password as text. Controlled with `onVisibleChange`; a form submit hides it again. */
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  /**
   * A strength meter under the field while it holds text. `true` uses the
   * built-in estimator (`estimatePasswordStrength`, no dependency); a function
   * plugs in your own.
   */
  strength?: boolean | PasswordStrengthEstimator;
  /** The length the built-in estimator asks for. @default 8 */
  minStrengthLength?: number;
  /** Warns while Caps Lock is on. @default true */
  capsLockWarning?: boolean;
  labels?: LabelsProp<PasswordInputLabels>;
  /** `className` styles the root (the field, the warning and the meter); `frame` is the input's box. */
  classNames?: SlotClassNames<"frame" | "input" | "toggle" | "capsLock" | "meter" | "hints">;
}

const SEGMENTS = 5;

const SCORE_TONE: Record<PasswordStrength["score"], Extract<Tone, "error" | "warning" | "success">> = {
  0: "error",
  1: "error",
  2: "warning",
  3: "success",
  4: "success",
};

const SEGMENT_FILL: Record<"error" | "warning" | "success", string> = {
  error: "bg-status-error",
  warning: "bg-status-warning",
  success: "bg-status-success",
};

/**
 * A password field. The eye button shows the password as text and back
 * (`aria-pressed`; a press keeps focus and the caret where they were), Caps
 * Lock is flagged while the field has focus, and an optional strength meter
 * (`role="meter"`, its score in words, with hints) follows the text.
 * `autoComplete` tells password managers which password this is. Binds to a
 * `Form` through `Field name`; `ref` and the other props address the `<input>`.
 */
export function PasswordInput({
  value,
  defaultValue = "",
  onValueChange,
  autoComplete = "current-password",
  visible: visibleProp,
  defaultVisible = false,
  onVisibleChange,
  strength,
  minStrengthLength = 8,
  capsLockWarning = true,
  labels: labelsProp,
  className,
  classNames,
  end,
  ref,
  onChange,
  onKeyDown,
  onKeyUp,
  onBlur,
  "aria-describedby": describedByProp,
  ...props
}: PasswordInputProps) {
  const labels = useLabels("PasswordInput", DEFAULT_PASSWORD_INPUT_LABELS, labelsProp);
  const field = useField();
  const [text, setText, fieldName] = useFieldValue({
    value,
    defaultValue,
    onChange: onValueChange,
    fromForm: (raw) => (typeof raw === "string" ? raw : ""),
  });
  const [visible, setVisible] = useControllableState({ value: visibleProp, defaultValue: defaultVisible, onChange: onVisibleChange });
  const disabled = (props.disabled ?? field?.disabled) === true;

  const inputRef = useRef<HTMLInputElement>(null);
  const setInputRef = useMemo(() => mergeRefs(ref, inputRef), [ref]);

  // Swapping `type` can reset the selection: keep the caret (or selection) across the swap.
  const savedSelection = useRef<{ start: number; end: number; direction: "forward" | "backward" | "none" } | null>(null);
  const toggle = () => {
    const input = inputRef.current;
    if (input && input.selectionStart !== null && input.selectionEnd !== null) {
      savedSelection.current = { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection ?? "none" };
    }
    setVisible((shown) => !shown);
  };
  useLayoutEffect(() => {
    const saved = savedSelection.current;
    const input = inputRef.current;
    savedSelection.current = null;
    if (!saved || !input) return;
    // Chromium resets the selection when it next updates the field's style after the swap,
    // which would undo a restore made before it: update it now.
    void input.offsetWidth;
    input.setSelectionRange(saved.start, saved.end, saved.direction);
  }, [visible]);

  // A submitted password is hidden again, so it is never left on screen (or saved by a manager as text).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, [setVisible]);

  const [region, announce] = useAnnouncer();
  const [capsLock, setCapsLock] = useState(false);
  const readCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!capsLockWarning) return;
    const on = event.getModifierState("CapsLock");
    if (on && !capsLock) announce(labels.capsLock);
    setCapsLock(on);
  };

  const estimator: PasswordStrengthEstimator | null =
    typeof strength === "function"
      ? strength
      : strength
        ? (password) => estimatePasswordStrength(password, labels, minStrengthLength)
        : null;
  const result = estimator && text !== "" ? estimator(text) : null;

  // The score in words is announced as it changes (not every keystroke): the meter is not live.
  const spokenScore = result ? `${labels.strength}: ${result.label}` : "";
  const lastSpoken = useRef(spokenScore);
  useEffect(() => {
    if (spokenScore === lastSpoken.current) return;
    lastSpoken.current = spokenScore;
    if (spokenScore) announce(spokenScore);
  }, [spokenScore, announce]);

  const baseId = useId();
  const capsId = `${baseId}-caps`;
  const strengthId = `${baseId}-strength`;
  const hintsId = `${baseId}-hints`;
  const capsShown = capsLockWarning && capsLock;
  const describedBy =
    [describedByProp, capsShown ? capsId : undefined, result ? strengthId : undefined, result?.hints.length ? hintsId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  const tone = result ? SCORE_TONE[result.score] : null;

  return (
    <div className={cn("grid min-w-0 gap-r5", className)}>
      <Input
        ref={setInputRef}
        {...props}
        type={visible ? "text" : "password"}
        name={props.name ?? fieldName}
        value={text}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={describedBy}
        onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => setText(event.target.value))}
        onKeyDown={composeEventHandlers(onKeyDown, readCapsLock)}
        onKeyUp={composeEventHandlers(onKeyUp, readCapsLock)}
        onBlur={composeEventHandlers(onBlur, () => setCapsLock(false))}
        className={classNames?.frame}
        classNames={{ input: classNames?.input }}
        end={
          <>
            {end}
            <IconButton
              data-print="hide"
              label={labels.show}
              aria-pressed={visible}
              icon={visible ? <EyeOff /> : <Eye />}
              disabled={disabled}
              // A press keeps focus in the field, so typing goes on where it was.
              onMouseDown={keepFocus}
              onClick={toggle}
              className={classNames?.toggle}
            />
          </>
        }
      />
      {capsShown && (
        <p id={capsId} className={cn("flex items-start gap-r5 text-body-2 text-fg-warning", classNames?.capsLock)}>
          <span className="flex h-(--BodyText-2-line-height) shrink-0 items-center">
            <TriangleAlert aria-hidden className="size-icon text-status-warning" />
          </span>
          <span className="min-w-0 break-words">{labels.capsLock}</span>
        </p>
      )}
      {result && tone && (
        <div className={cn("grid min-w-0 gap-r6", classNames?.meter)} data-score={result.score}>
          <div className="flex min-w-0 items-center gap-r4">
            <div
              role="meter"
              aria-label={labels.strength}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={result.score}
              aria-valuetext={result.label}
              data-print="exact"
              className="flex min-w-0 flex-1 gap-r6"
            >
              {Array.from({ length: SEGMENTS }, (_, index) => (
                <span
                  key={index}
                  data-filled={index <= result.score ? "" : undefined}
                  className={cn(
                    "h-r5 min-w-0 flex-1 rounded-full border border-transparent",
                    index <= result.score ? SEGMENT_FILL[tone] : "bg-fg-primary/10",
                  )}
                />
              ))}
            </div>
            <span id={strengthId} className={cn("shrink-0 text-body-2 font-medium", TONE_TEXT[tone])}>
              {result.label}
            </span>
          </div>
          {result.hints.length > 0 && (
            <ul id={hintsId} className={cn("grid gap-r6 text-body-2 text-fg-muted", classNames?.hints)}>
              {result.hints.map((hint) => (
                <li key={hint} className="min-w-0 break-words">
                  {hint}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {region}
    </div>
  );
}
