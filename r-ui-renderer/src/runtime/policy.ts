import { sameList } from "../render/memo";
import type { HostPolicy } from "../spec/types";
import { defaultAllowImageUrl, defaultAllowUrl } from "../spec/url-policy";
import type { ResolvedPolicy } from "./context";

const NONE: readonly string[] = Object.freeze([]);

// Wrapped so a caller passing a second argument (`urls.filter(policy.allowUrl)`) never sets their base.
const sameOrigin = (url: URL): boolean => defaultAllowUrl(url);
const sameOriginImage = (url: URL): boolean => defaultAllowImageUrl(url);

/** What the view runs with when the host sets nothing. */
export const DEFAULT_POLICY: ResolvedPolicy = Object.freeze({
  allowUrl: sameOrigin,
  allowImageUrl: sameOriginImage,
  markdownImages: NONE,
  allowSensitive: false,
  themeOverrides: true,
});

/** The host's policy with every absent member at its default. */
export function resolvePolicy(policy: HostPolicy | undefined): ResolvedPolicy {
  if (policy === undefined) return DEFAULT_POLICY;
  return {
    allowUrl: policy.allowUrl ?? sameOrigin,
    allowImageUrl: policy.allowImageUrl ?? sameOriginImage,
    markdownImages: policy.markdownImages ?? NONE,
    allowSensitive: policy.allowSensitive ?? false,
    themeOverrides: policy.themeOverrides ?? true,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || (Array.isArray(a) && Array.isArray(b) && sameList(a, b));
}

/** Member by member, lists by their items: a host's inline policy object with the same contents is the same policy. */
export function samePolicy(a: ResolvedPolicy, b: ResolvedPolicy): boolean {
  return (
    a === b ||
    (sameValue(a.allowUrl, b.allowUrl) &&
      sameValue(a.allowImageUrl, b.allowImageUrl) &&
      sameValue(a.markdownImages, b.markdownImages) &&
      sameValue(a.allowSensitive, b.allowSensitive) &&
      sameValue(a.themeOverrides, b.themeOverrides))
  );
}
