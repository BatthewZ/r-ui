/**
 * tailwind-merge configured for the @batthewz/r-ui-css utilities.
 *
 * Public API:
 *   - `cn(...inputs)`: `clsx` + `twMerge` for the built-in token list.
 *   - `createCn(extension)`: a `cn` aware of the built-in tokens plus yours.
 *     Your `theme` and `classGroups` arrays are concatenated onto the built-ins.
 *   - `mergeExtension(extension)`: the `ConfigExtension` `createCn` passes to
 *     `extendTailwindMerge`, for driving it yourself.
 *   - `tailwindMergeExtension`: the raw built-in mirror.
 *   - `twMerge`: the pre-configured tailwind-merge instance, without `clsx`.
 */
import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * The mirror of r-ui-css's `@theme` names and `@utility` classes, one list per
 * Tailwind namespace. A test parses r-ui-css and fails on any difference, in
 * either direction.
 *
 * Namespaces tailwind-merge has a theme key for go under `theme`. `--opacity-*`,
 * `--transition-duration-*` and `--z-index-*` have none, so they extend the
 * `opacity`, `duration` and `z` class groups. `@utility` classes get their own
 * class groups, except one that shares its class with a theme utility (the face
 * on `text-h1`, forced-colors handling on `bg-accent`): that is still the one
 * theme name.
 */
export const tailwindMergeExtension = deepFreeze({
  theme: {
    color: [
      "canvas",
      "surface-0",
      "surface-1",
      "surface-2",
      "surface-3",
      "fg-primary",
      "fg-secondary",
      "fg-muted",
      "fg-inverse",
      "fg-accent",
      "fg-on-primary",
      "fg-on-accent",
      "fg-on-selection",
      "fg-error",
      "fg-success",
      "fg-warning",
      "fg-info",
      "fg-on-error",
      "fg-on-success",
      "fg-on-warning",
      "fg-on-info",
      "border",
      "border-strong",
      "scrim",
      "primary",
      "primary-hover",
      "primary-active",
      "accent",
      "accent-hover",
      "selection",
      "focus",
      "status-error",
      "status-error-bg",
      "status-success",
      "status-success-bg",
      "status-warning",
      "status-warning-bg",
      "status-info",
      "status-info-bg",
    ],
    font: ["ui", "heading", "display", "mono"],
    "font-weight": ["normal", "medium", "semibold"],
    text: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "body-1", "body-2", "body-3",
      "display-1", "display-2", "display-3", "display-4",
      "prose-1", "prose-2", "prose-3",
    ],
    spacing: [
      "r1", "r2", "r3", "r4", "r5", "r6",
      "control", "row", "icon", "hit",
      "section-1", "section-2", "section-3", "gutter",
    ],
    container: ["measure", "page", "column-lg", "column-md", "column-sm"],
    radius: ["sm", "md", "lg", "xl", "full"],
    shadow: ["sm", "md", "lg"],
    ease: ["standard", "enter", "exit"],
    animate: [
      "fade-in",
      "fade-out",
      "fade-up",
      "fade-down",
      "fade-start",
      "fade-end",
      "slide-in-end",
      "slide-out-end",
      "scale-in",
      "scale-out",
      "morph-expand",
      "morph-collapse",
      "morph-reorder",
    ],
  },
  classGroups: {
    opacity: [{ opacity: ["disabled"] }],
    duration: [{ duration: ["fast", "normal", "slow"] }],
    z: [{ z: ["raised", "sticky", "docked", "bypass"] }],
    // Both set the whole outline, so the last one wins.
    "focus-ring": ["focus-ring", "focus-ring-inset"],
    "hit-area": ["hit-area"],
  },
});

/** Concatenate `extra`'s arrays onto `base`'s, key by key (base first). */
function concatByKey(base = {}, extra = {}) {
  const merged = { ...base };
  for (const [key, list] of Object.entries(extra)) {
    merged[key] = Array.isArray(base[key]) && Array.isArray(list) ? [...base[key], ...list] : list;
  }
  return merged;
}

/**
 * Merge a user extension onto the built-ins and return a full tailwind-merge
 * `ConfigExtension`. Group keys (`theme`, `classGroups`,
 * `conflictingClassGroups`, ...) sit at the top level of `userExtension` and go
 * into `extend`; `theme` and `classGroups` arrays are concatenated onto the
 * built-ins (built-ins first). Static keys (`cacheSize`, `prefix`, ...) stay at
 * the top level.
 */
export function mergeExtension(userExtension = {}) {
  if ("extend" in userExtension) {
    throw new TypeError("Pass `theme`, `classGroups`, ... at the top level, not under `extend`.");
  }
  const {
    theme,
    classGroups,
    conflictingClassGroups,
    conflictingClassGroupModifiers,
    postfixLookupClassGroups,
    orderSensitiveModifiers,
    ...staticPart
  } = userExtension;
  return {
    ...staticPart,
    extend: {
      theme: concatByKey(tailwindMergeExtension.theme, theme),
      classGroups: concatByKey(tailwindMergeExtension.classGroups, classGroups),
      conflictingClassGroups,
      conflictingClassGroupModifiers,
      postfixLookupClassGroups,
      orderSensitiveModifiers,
    },
  };
}

/** Create a `clsx` + `twMerge` helper aware of the built-in tokens plus `extension`. */
export function createCn(extension = {}) {
  const merge = extendTailwindMerge(mergeExtension(extension));
  return function cn(...inputs) {
    return merge(clsx(inputs));
  };
}

/** Pre-configured tailwind-merge instance: built-in tokens only. */
export const twMerge = extendTailwindMerge(mergeExtension());

/** `clsx` + `twMerge` helper: built-in tokens only. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
