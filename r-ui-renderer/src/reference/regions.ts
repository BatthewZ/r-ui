// Splicing generated regions into the hand-written reference. Internal: shared
// by `./reference` and `scripts/gen-viewspec.mjs`, never exported from the subpath.

const REGION = /<!-- GENERATED:([a-z-]+) -->\n[\s\S]*?<!-- \/GENERATED:\1 -->/g;

/** The region names `markdown` carries, in document order. */
export function regionNames(markdown: string): string[] {
  return [...markdown.matchAll(REGION)].map((match) => match[1] as string);
}

/** `markdown` with every region emptied: the hand-written half alone. */
export function emptyRegions(markdown: string): string {
  return markdown.replace(REGION, (_, name: string) => `<!-- GENERATED:${name} -->\n<!-- /GENERATED:${name} -->`);
}

/**
 * `markdown` with each region rewritten from `bodies`. Both sides must name the
 * same regions: a region with no body would stay as written (stale, or empty)
 * while every comparison of a generation with itself still agreed.
 */
export function fillRegions(markdown: string, bodies: { readonly [name: string]: string }): string {
  const present = regionNames(markdown);
  const missing = Object.keys(bodies).filter((name) => !present.includes(name));
  const unfilled = present.filter((name) => !Object.hasOwn(bodies, name));
  if (missing.length > 0) throw new Error(`the document has no GENERATED region for: ${missing.join(", ")}`);
  if (unfilled.length > 0) throw new Error(`nothing renders the document's GENERATED region(s): ${unfilled.join(", ")}`);
  // A function replacer: a body may contain `$&`, which a replacement string would expand.
  return markdown.replace(
    REGION,
    (_, name: string) => `<!-- GENERATED:${name} -->\n${bodies[name] as string}\n<!-- /GENERATED:${name} -->`,
  );
}
