import type { ClassValue } from "clsx";
import type { ClassNameValue, ConfigExtension } from "tailwind-merge";

type ConfigGroups = NonNullable<ConfigExtension<string, string>["extend"]>;

/**
 * Extension accepted by `createCn` / `mergeExtension`: tailwind-merge's group
 * keys (`theme`, `classGroups`, `conflictingClassGroups`, ...) at the TOP LEVEL,
 * not under `extend`. `theme` and `classGroups` arrays are concatenated onto the
 * built-ins, key by key. Static keys (`cacheSize`, `prefix`, ...) and `override`
 * pass through to `extendTailwindMerge`.
 */
export interface RUiExtension extends Omit<ConfigExtension<string, string>, "extend">, ConfigGroups {}

/**
 * Built-in mirror of `@batthewz/r-ui-css`'s utility names, one list per Tailwind
 * namespace. Deeply frozen. The names are deliberately typed as `string`: the JS
 * file is the only copy, and a test holds it equal to the CSS.
 */
export declare const tailwindMergeExtension: {
  readonly theme: {
    readonly color: readonly string[];
    readonly font: readonly string[];
    readonly "font-weight": readonly string[];
    readonly text: readonly string[];
    readonly spacing: readonly string[];
    readonly container: readonly string[];
    readonly radius: readonly string[];
    readonly shadow: readonly string[];
    readonly ease: readonly string[];
    readonly animate: readonly string[];
  };
  readonly classGroups: {
    readonly opacity: readonly [{ readonly opacity: readonly string[] }];
    readonly duration: readonly [{ readonly duration: readonly string[] }];
    readonly z: readonly [{ readonly z: readonly string[] }];
    readonly "focus-ring": readonly string[];
    readonly "hit-area": readonly string[];
  };
};

/** The `ConfigExtension` that `createCn` passes to `extendTailwindMerge`; see `RUiExtension`. */
export declare function mergeExtension(userExtension?: RUiExtension): ConfigExtension<string, string>;

/** Create a `clsx` + `twMerge` helper aware of the built-in tokens plus `extension`. */
export declare function createCn(extension?: RUiExtension): (...inputs: ClassValue[]) => string;

/** Pre-configured tailwind-merge instance: built-in tokens only. */
export declare const twMerge: (...classLists: ClassNameValue[]) => string;

/** `clsx` + `twMerge` helper: built-in tokens only. */
export declare function cn(...inputs: ClassValue[]): string;
