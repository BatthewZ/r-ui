/**
 * The judgements the renderer makes on a resolved prop value before a
 * component sees it: URLs, images and Intl input, on the policy the
 * validator reads too.
 */

import type { ResolvedPolicy } from "../runtime/context";
import { resolveUrl, safeUrl, srcSetUrls } from "../spec/url-policy";
import { isCurrencyCode, isIntlUnit } from "../spec/validate-values";

/** A URL the scheme allowlist keeps (an empty string names nothing and passes). */
export function urlAllowed(value: string): boolean {
  return value === "" || safeUrl(value) !== "";
}

/** A URL the browser may fetch as an image: the scheme allowlist, then the host's image policy. */
export function imageAllowed(value: string, policy: ResolvedPolicy): boolean {
  const url = resolveUrl(value);
  if (url === null) return false;
  try {
    return policy.allowImageUrl(url);
  } catch {
    return false;
  }
}

/** Every image a `srcset` names passes the image policy. */
export function srcSetAllowed(value: string, policy: ResolvedPolicy): boolean {
  return srcSetUrls(value).every((url) => imageAllowed(url, policy));
}

/** A value `Intl` accepts as a currency code or a unit identifier. */
export function intlValueAllowed(value: unknown, kind: "currency" | "unit"): boolean {
  return typeof value === "string" && (kind === "currency" ? isCurrencyCode(value) : isIntlUnit(value));
}
