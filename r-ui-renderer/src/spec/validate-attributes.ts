/**
 * HTML attributes, in React's spelling, that a component passing its
 * element's attributes through (`nativeAttributes`) accepts beyond its own
 * props. The `unknown-prop` check reads it so that `"type": "email"` on an
 * Input is known while `"varient"` is not. `aria-*`, `data-*` and `on[A-Z]…`
 * are matched by pattern; ids and what points at them are the policy's
 * (`ID_REFERENCE_PROPS`), dropped whatever this list says.
 */

const GLOBAL = [
  "accessKey",
  "autoCapitalize",
  "autoCorrect",
  "autoFocus",
  "contentEditable",
  "dir",
  "draggable",
  "enterKeyHint",
  "hidden",
  "inert",
  "inputMode",
  "itemProp",
  "itemScope",
  "itemType",
  "lang",
  "popover",
  "role",
  "slot",
  "spellCheck",
  "tabIndex",
  "title",
  "translate",
];

const FORM = [
  "accept",
  "alt",
  "autoComplete",
  "capture",
  "checked",
  "cols",
  "defaultChecked",
  "defaultValue",
  "dirName",
  "disabled",
  "high",
  "label",
  "low",
  "max",
  "maxLength",
  "min",
  "minLength",
  "multiple",
  "noValidate",
  "optimum",
  "pattern",
  "placeholder",
  "readOnly",
  "required",
  "rows",
  "selected",
  "size",
  "step",
  "type",
  "value",
  "wrap",
];

const LINK_AND_MEDIA = [
  "autoPlay",
  "cite",
  "controls",
  "crossOrigin",
  "dateTime",
  "decoding",
  "download",
  "fetchPriority",
  "height",
  "href",
  "hrefLang",
  "loading",
  "loop",
  "media",
  "muted",
  "open",
  "playsInline",
  "poster",
  "preload",
  "referrerPolicy",
  "rel",
  "reversed",
  "sizes",
  "src",
  "srcSet",
  "start",
  "target",
  "width",
];

const TABLE = ["abbr", "align", "colSpan", "rowSpan", "scope", "span"];

const NATIVE: ReadonlySet<string> = new Set([...GLOBAL, ...FORM, ...LINK_AND_MEDIA, ...TABLE]);

/** A prop a native-attribute component takes as an HTML attribute. */
export function isNativeAttribute(name: string): boolean {
  return NATIVE.has(name) || /^aria-[a-z]+$/.test(name) || /^on[A-Z]/.test(name);
}
