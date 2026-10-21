// The reference's renderers over any prose; `./reference` binds them to the
// shipped VIEWSPEC.md and `scripts/gen-viewspec.mjs` to the file on disk.

import { defaultContracts } from "../contracts";
import type { ComponentContracts } from "../spec/types";
import { CLASS_VOCABULARY, ICON_NAMES } from "../spec/vocabulary";
import { renderComponentTables, renderSlotTable } from "./components";
import { renderClasses, renderIcons, renderIssueCodes, renderNotAddressable } from "./lists";
import { emptyRegions, fillRegions } from "./regions";
import { scopeContracts } from "./scope";

export interface RegionOptions {
  /**
   * Props listed per component before "+n more"; `false` (the default) lists
   * every one. A limit is a concession to breadth: a scoped reference should
   * keep them all, since a prop it hides is one an author then invents.
   */
  readonly propLimit?: number | false;
  /** Each prop's one-sentence description beside it (larger; worth it for a narrow scope). */
  readonly describeProps?: boolean;
  /** The host's icon names, as given to the validator's `icons`; the shipped set when absent. */
  readonly icons?: readonly string[];
  /** The host's class vocabulary, as given to the validator's `classes`; the shipped one when absent. */
  readonly classes?: readonly string[];
}

export interface ReferenceOptions extends RegionOptions {
  /** The contracts to document; `defaultContracts` when absent (extend it with `extendContracts`). */
  readonly contracts?: ComponentContracts;
  /** Only these components. A part brings its root and a root all its parts; an unknown name throws. */
  readonly include?: readonly string[];
}

/** The generated Markdown for a set of contracts, for a host to place in its own prose. */
export interface ReferenceRegions {
  /** `###` sections by category: a table of each component, its parts, props and note. */
  readonly components: string;
  /** Each component's `classNames` keys, or a sentence saying none takes any. */
  readonly slots: string;
  readonly issueCodes: string;
  /** The library components documents cannot use, and why. Never scoped. */
  readonly notAddressable: string;
  readonly icons: string;
  readonly classes: string;
}

export function renderReferenceRegions(contracts: ComponentContracts, options: RegionOptions = {}): ReferenceRegions {
  const { propLimit = false, describeProps = false, icons = ICON_NAMES, classes = CLASS_VOCABULARY } = options;
  if (propLimit !== false && !(Number.isInteger(propLimit) && propLimit > 0)) {
    throw new Error(`propLimit must be a positive integer or false, not ${String(propLimit)}.`);
  }
  return {
    components: renderComponentTables(contracts, { propLimit, describeProps }),
    slots: renderSlotTable(contracts),
    issueCodes: renderIssueCodes(),
    notAddressable: renderNotAddressable(),
    icons: renderIcons(icons),
    classes: renderClasses(classes),
  };
}

/** Components the prose's examples author (`"component": "X"`) that `contracts` does not document. */
function undocumentedInProse(prose: string, contracts: ComponentContracts): string[] {
  const authored = [...emptyRegions(prose).matchAll(/"component":\s*"([\w.]+)"/g)].map((match) => match[1] as string);
  return [...new Set(authored)].filter((name) => !Object.hasOwn(contracts, name));
}

/**
 * Stated rather than fixed: a scope narrows the tables, never the prose, and
 * a scoped-away component still renders. No "above"/"below": the examples sit
 * on both sides of the region.
 */
function scopeWarning(names: readonly string[]): string {
  const list = names.map((name) => `\`${name}\``).join(", ");
  const one = names.length === 1;
  return (
    `**This reference is scoped.** Its worked examples also author ${list}, which ${one ? "is" : "are"} not documented here: ` +
    `${one ? "it still renders" : "they still render"}, with no props to check against. Author only components with a row in these tables.`
  );
}

/** `prose` (a document carrying the GENERATED markers) with every region rendered for `options`. */
export function renderDocument(prose: string, options: ReferenceOptions = {}): string {
  const { contracts = defaultContracts, include, ...rest } = options;
  const scoped = include === undefined ? contracts : scopeContracts(contracts, include);
  const regions = renderReferenceRegions(scoped, rest);
  const undocumented = undocumentedInProse(prose, scoped);
  const components = [
    ...(undocumented.length > 0 ? [scopeWarning(undocumented)] : []),
    regions.components,
    regions.slots,
  ].join("\n\n");
  return fillRegions(prose, {
    classes: regions.classes,
    "issue-codes": regions.issueCodes,
    components,
    "not-addressable": regions.notAddressable,
    icons: regions.icons,
  });
}
