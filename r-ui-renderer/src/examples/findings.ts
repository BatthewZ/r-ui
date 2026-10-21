/**
 * The corpus's ledger of known findings: issues a document cannot avoid
 * without bending the advice it models, each the validator's or the
 * renderer's shortfall, named by code, component and prop. The corpus tests
 * and the browser checks both read it, and every entry must still be found,
 * so a fix cannot leave a stale excuse behind.
 */

import { isPlainObject } from "../spec/guards";
import { parsePointer } from "../spec/pointer";
import type { IssueCode } from "../spec/types";
import type { ExampleName } from "./index";

export interface Finding {
  readonly code: IssueCode;
  readonly component: string;
  /** The prop the issue's path names; `""` for the node's `component`. */
  readonly prop: string;
  readonly reason: string;
}

const OPTION_VALUE: Finding = {
  code: "controlled-in-field",
  component: "Radio",
  prop: "value",
  reason: "an option's `value` names the option (it is required); only the Field's control itself may not hold a value",
};

export const FINDINGS: { readonly [name in ExampleName]?: readonly Finding[] } = {
  "settings-form": [OPTION_VALUE],
  form: [OPTION_VALUE, { ...OPTION_VALUE, component: "SegmentedControl.Item" }],
  media: [
    {
      code: "forbidden-prop",
      component: "MasonryGrid",
      prop: "list",
      reason: "MasonryGrid's own `list` (render as a list) is dropped as if it were the DOM `list` id reference",
    },
  ],
  toolbar: [
    {
      code: "misplaced-part",
      component: "Toolbar.Item",
      prop: "menu",
      reason: "a Toolbar.Item's `menu` is the DropdownMenu item it becomes in the overflow menu, which the Toolbar renders",
    },
  ],
  marketing: [
    {
      code: "misplaced-part",
      component: "MediaCard.Skeleton",
      prop: "",
      reason: "MediaCard.Skeleton stands in for a whole MediaCard while it loads; it never sits inside one",
    },
  ],
};

function valueAt(root: unknown, pointer: string): unknown {
  let value = root;
  for (const token of parsePointer(pointer) ?? []) {
    if (Array.isArray(value)) value = value[Number(token)];
    else if (isPlainObject(value) && Object.hasOwn(value, token)) value = value[token];
    else return undefined;
  }
  return value;
}

/** The component and prop an issue's path names in `document`: `…/props/<prop>…`, or `…/component` (prop `""`). */
export function issueSite(document: unknown, path: string): { readonly component: string; readonly prop: string } {
  const match = /^(.*?)(?:\/props\/([^/]+).*|\/component)$/.exec(path);
  const node = match ? valueAt(document, match[1] ?? "") : undefined;
  return {
    component: isPlainObject(node) && typeof node.component === "string" ? node.component : "",
    prop: match?.[2] ?? "",
  };
}

/** Whether `issue` (a validator or render issue, or a diagnostic element's code and path) is `finding` in `document`. */
export function isFinding(document: unknown, finding: Finding, issue: { readonly code: string | null; readonly path: string | null }): boolean {
  const site = issueSite(document, issue.path ?? "");
  return issue.code === finding.code && site.component === finding.component && site.prop === finding.prop;
}
