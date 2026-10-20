/**
 * The judgements the renderer makes on a resolved prop value before a
 * component sees it: URLs, images, element choices, Intl input, `data-*`.
 */

import type { RendererAdapters } from "../runtime/adapters";
import { CONSTRAINED_DATA_ATTRIBUTES, DATA_ATTRIBUTE_PATTERN, DROPPED_DATA_ATTRIBUTES, lowerCaseProp } from "../spec/policy";
import { defaultAllowImageUrl, resolveUrl, safeUrl } from "../spec/url-policy";

/** A URL the scheme allowlist keeps (an empty string names nothing and passes). */
export function urlAllowed(value: string): boolean {
  return value === "" || safeUrl(value) !== "";
}

/** A URL the browser may fetch as an image: the scheme allowlist, then the host's image policy. */
export function imageAllowed(value: string, adapters: RendererAdapters): boolean {
  const url = resolveUrl(value);
  if (url === null) return false;
  try {
    return (adapters.allowImageUrl ?? defaultAllowImageUrl)(url);
  } catch {
    return false;
  }
}

/** The URLs of a `srcset` list, as the HTML parser splits it (a `data:` URL may hold commas). */
export function srcSetUrls(value: string): string[] {
  const urls: string[] = [];
  let index = 0;
  while (index < value.length) {
    while (index < value.length && /[\s,]/.test(value.charAt(index))) index += 1;
    if (index >= value.length) break;
    const start = index;
    while (index < value.length && !/\s/.test(value.charAt(index))) index += 1;
    let url = value.slice(start, index);
    if (url.endsWith(",")) {
      urls.push(url.replace(/,+$/, ""));
      continue;
    }
    // Descriptors run to the next comma outside parentheses.
    let depth = 0;
    while (index < value.length) {
      const char = value.charAt(index);
      if (char === "(") depth += 1;
      else if (char === ")") depth = Math.max(0, depth - 1);
      else if (char === "," && depth === 0) break;
      index += 1;
    }
    url = url.trim();
    if (url.length > 0) urls.push(url);
  }
  return urls;
}

/** Every image a `srcset` names passes the image policy. */
export function srcSetAllowed(value: string, adapters: RendererAdapters): boolean {
  return srcSetUrls(value).every((url) => imageAllowed(url, adapters));
}

/** A value `Intl` accepts as a currency code or a unit identifier. */
export function intlValueAllowed(value: unknown, kind: "currency" | "unit"): boolean {
  if (typeof value !== "string") return false;
  if (kind === "currency" && !/^[A-Za-z]{3}$/.test(value)) return false;
  try {
    new Intl.NumberFormat("en", kind === "currency" ? { style: "currency", currency: value } : { style: "unit", unit: value });
    return true;
  } catch {
    return false;
  }
}

export type DataAttributeVerdict = "keep" | "forbidden" | "invalid";

/** A `data-*` attribute's fate: its name, then its (resolved) value. */
export function judgeDataAttribute(name: string, value: unknown): DataAttributeVerdict {
  const lower = lowerCaseProp(name);
  if (!DATA_ATTRIBUTE_PATTERN.test(name) || DROPPED_DATA_ATTRIBUTES.some((dropped) => dropped === lower)) return "forbidden";
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return "invalid";
  const allowed = Object.hasOwn(CONSTRAINED_DATA_ATTRIBUTES, lower) ? CONSTRAINED_DATA_ATTRIBUTES[lower] : undefined;
  if (allowed !== undefined && !allowed.some((option) => option === value)) return "invalid";
  return "keep";
}
