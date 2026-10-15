"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface UseCommandPaletteShortcutOptions {
  /** With Cmd (Apple) or Ctrl (elsewhere). @default "k" */
  key?: string;
  /** @default true */
  enabled?: boolean;
  /** Also fire while typing in a field. @default false */
  allowInEditable?: boolean;
}

export interface CommandPaletteShortcut {
  /** One key cap per entry, for display: `["⌘", "K"]` or `["Ctrl", "K"]`. */
  keys: readonly string[];
  /** For the opener's `aria-keyshortcuts`: `"Meta+K"` or `"Control+K"`. */
  ariaKeyShortcuts: string;
}

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function isApple() {
  if (typeof navigator === "undefined") return false;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform;
  return /mac|iphone|ipad|ipod/iu.test(platform);
}

/**
 * Calls `onShortcut` on Cmd+K (Apple) or Ctrl+K (elsewhere), the palette
 * convention. Ignored while an IME is composing, on key repeat, and (unless
 * `allowInEditable`) while focus is in a text field, where the reader is
 * typing. Prevents the browser's own use of the chord. Returns the chord for
 * display.
 */
export function useCommandPaletteShortcut(
  onShortcut: () => void,
  { key = "k", enabled = true, allowInEditable = false }: UseCommandPaletteShortcutOptions = {},
): CommandPaletteShortcut {
  const [apple, setApple] = useState(false);
  useEffect(() => setApple(isApple()), []);

  const latest = useRef(onShortcut);
  useLayoutEffect(() => {
    latest.current = onShortcut;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      // 229: the keyCode an IME reports while composing (Safari leaves isComposing false).
      if (event.isComposing || event.keyCode === 229 || event.repeat || event.defaultPrevented) return;
      if (event.key.toLowerCase() !== key.toLowerCase() || event.altKey || event.shiftKey) return;
      const modifier = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (!modifier) return;
      if (!allowInEditable && event.target instanceof Element && event.target.closest(EDITABLE)) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, key, allowInEditable, apple]);

  const cap = key.length === 1 ? key.toUpperCase() : key;
  return apple
    ? { keys: ["⌘", cap], ariaKeyShortcuts: `Meta+${cap}` }
    : { keys: ["Ctrl", cap], ariaKeyShortcuts: `Control+${cap}` };
}
