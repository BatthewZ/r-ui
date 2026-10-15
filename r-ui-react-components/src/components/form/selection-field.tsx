"use client";
import { ChevronDown, X } from "lucide-react";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "../../util/style";

import { focusInputFromFrame, keepFocus } from "./Input";
import type { SelectionPopup } from "./selection-popup";

export interface SelectionFrameProps {
  frameRef: Ref<HTMLDivElement>;
  inputRef: RefObject<HTMLInputElement | null>;
  invalid: boolean;
  disabled: boolean | undefined;
  readOnly: boolean | undefined;
  /** Chips wrap inside the frame, which grows a `--CONTROL-H` row at a time. */
  chips?: boolean;
  /** A press on the frame (not on a button inside it) also does this: opens the list. */
  onPress?: () => void;
  start?: ReactNode;
  end?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The bordered box shared by the selection inputs: Input's frame (`r-form-frame`,
 * ring around the whole box), `h-control` tall, or a wrapping chip row whose
 * every line is one `--CONTROL-H` (see `.r-form-chip-frame`).
 */
export function SelectionFrame({
  frameRef,
  inputRef,
  invalid,
  disabled,
  readOnly,
  chips = false,
  onPress,
  start,
  end,
  className,
  children,
}: SelectionFrameProps) {
  return (
    <div
      ref={frameRef}
      className={cn(
        "r-form-frame r-form-text-frame flex w-full min-w-0",
        chips ? "r-form-chip-frame min-h-control items-start" : "h-control items-center gap-r4 px-r3",
        className,
      )}
      data-invalid={invalid ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
      onMouseDown={(event) => {
        if (focusInputFromFrame(event, inputRef.current, disabled) && !readOnly) onPress?.();
      }}
    >
      {start != null && <span className={cn("r-form-adornment", chips && "r-form-chip-adornment")}>{start}</span>}
      {chips ? <div className="r-form-chip-row">{children}</div> : children}
      {end != null && <span className={cn("r-form-adornment", chips && "r-form-chip-adornment")}>{end}</span>}
    </div>
  );
}

/** The chevron that opens and closes the list. Out of the tab order: the keyboard has the arrows. */
export function SelectionToggle({
  popup,
  label,
  inputRef,
}: {
  popup: SelectionPopup;
  label: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const { open, setOpen, controls } = popup;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      onMouseDown={keepFocus}
      onClick={() => {
        inputRef.current?.focus();
        setOpen(!open);
      }}
      className="r-form-icon-button hit-area"
    >
      <ChevronDown aria-hidden className={cn("transition-transform duration-fast", open && "rotate-180")} />
    </button>
  );
}

/** Whether a blur takes focus out of `root` (not into a part of it, such as the list rendered in place inside it). */
export function focusLeaves(root: HTMLElement | null, event: FocusEvent): boolean {
  const next = event.relatedTarget;
  return !(next instanceof Node && root?.contains(next));
}

/**
 * One polite live region per control, for what the eye sees and the ear would
 * otherwise miss: a tag added from a paste, a chip removed, a refusal, a count
 * of results. Re-announcing the same sentence alternates a trailing space.
 */
export function useAnnouncer(): [ReactNode, (text: string) => void] {
  const [message, setMessage] = useState("");
  const announce = useCallback(
    (text: string) => setMessage((previous) => (previous === text ? `${text} ` : text)),
    [],
  );
  const region = (
    <span role="status" className="sr-only">
      {message}
    </span>
  );
  return [region, announce];
}

export interface ChipItem {
  key: string;
  label: string;
}

export interface SelectionChipsProps {
  /** The list's id (a summary that expands it points at it). */
  id?: string;
  chips: ChipItem[];
  /** Names the list ("Selected regions"). */
  label: string;
  removeLabel: (label: string) => string;
  onRemove: (index: number) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  chipClassName?: string;
}

/**
 * The chosen values as a list of chips, each with a remove button in the tab
 * order. Backspace or Delete on a chip's button removes it; the arrows move
 * between chips and on into the text input. After a removal, focus goes to the
 * chip that took its place, else the one before, else the input.
 */
export function SelectionChips({
  id,
  chips,
  label,
  removeLabel,
  onRemove,
  inputRef,
  disabled,
  readOnly,
  className,
  chipClassName,
}: SelectionChipsProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const pendingFocus = useRef<number | null>(null);

  useLayoutEffect(() => {
    const at = pendingFocus.current;
    if (at === null) return;
    pendingFocus.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [];
    const target = buttons[Math.min(at, buttons.length - 1)];
    if (target) target.focus();
    else inputRef.current?.focus();
  }, [chips.length, inputRef]);

  if (chips.length === 0) return null;

  const remove = (index: number) => {
    pendingFocus.current = index;
    onRemove(index);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      remove(index);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = (event.key === "ArrowRight") !== rtl;
    const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const next = buttons[index + (forward ? 1 : -1)];
    event.preventDefault();
    if (next) next.focus();
    else if (forward) inputRef.current?.focus();
  };

  return (
    // `display: contents`: the chips wrap in the frame's own row beside the input.
    <ul ref={listRef} id={id} aria-label={label} className={cn("contents", className)}>
      {chips.map((chip, index) => (
        <li key={chip.key} className={cn("r-form-chip", chipClassName)}>
          <span className="min-w-0 truncate" title={chip.label}>
            {chip.label}
          </span>
          {!readOnly && (
            <button
              type="button"
              aria-label={removeLabel(chip.label)}
              disabled={disabled}
              onClick={() => remove(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="r-form-chip-remove hit-area"
            >
              <X aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Whether `el` has a box: a `display: none` ancestor (a container query folding chips away) takes it out. */
function isRendered(el: Element): boolean {
  if (typeof el.checkVisibility === "function") return el.checkVisibility();
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).display === "none") return false;
  }
  return true;
}

/**
 * Moves from the input's start onto the last chip (ArrowLeft in LTR, ArrowRight
 * in RTL), or onto the summary standing in for chips a narrow field hides.
 */
export function focusLastChip(event: KeyboardEvent<HTMLInputElement>, frame: HTMLElement | null): boolean {
  const input = event.currentTarget;
  if (input.selectionStart !== 0 || input.selectionEnd !== 0) return false;
  const rtl = getComputedStyle(input).direction === "rtl";
  if (event.key !== (rtl ? "ArrowRight" : "ArrowLeft")) return false;
  const removes = frame?.querySelectorAll<HTMLButtonElement>(".r-form-chip-remove");
  const candidates = [removes?.[removes.length - 1], frame?.querySelector<HTMLButtonElement>(".r-form-chip-summary")];
  const target = candidates.find((button) => button && !button.disabled && isRendered(button));
  if (!target) return false;
  event.preventDefault();
  target.focus();
  return true;
}

/** A form's value for a list control: its strings, the same array when it is all strings. */
export function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.every((v) => typeof v === "string") ? (value as string[]) : value.filter((v): v is string => typeof v === "string");
}

/** Native form submission for a value no visible input holds: one hidden input per value. */
export function HiddenValues({ name, values, form }: { name: string | undefined; values: readonly string[]; form?: string }) {
  if (!name) return null;
  return values.map((value, index) => <input key={`${index}:${value}`} type="hidden" name={name} value={value} form={form} />);
}
