/**
 * Whether a URL is safe to put in an attribute a browser resolves.
 *
 * Anything rendering a URL it did not write needs this answer (a link from a
 * CMS, an API, or a model; an image `src` passed through a prop), so it lives
 * here where components and consumers ask the same question and get the same
 * answer.
 */

/**
 * Characters a browser ignores while parsing a URL scheme: C0/C1 controls,
 * spaces, and zero-width marks. `java&#9;script:` navigates, so they are
 * stripped before the scheme is compared — testing the raw string is trivially
 * bypassed.
 *
 * Code-point ranges rather than a regex character class, because a regex
 * containing control characters is itself a lint error, escaped or not.
 */
function isIgnoredInScheme(code: number): boolean {
  return (
    code <= 0x20 ||
    (code >= 0x7f && code <= 0xa0) ||
    (code >= 0x200b && code <= 0x200d) ||
    code === 0xfeff
  );
}

/**
 * An **allowlist**, not a denylist of the three schemes everyone remembers.
 * `javascript:`/`vbscript:`/`data:text/html` is the list people write, and it
 * was this one until `data:image/svg+xml,<svg onload=…>` and
 * `data:application/xhtml+xml` were put through it — both scriptable, both
 * waved past. Enumerating what is dangerous is a losing game against a scheme
 * registry that keeps growing; enumerating what is safe is not.
 */
const ALLOWED_SCHEMES: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "mailto:",
  "tel:",
]);

/**
 * The `data:` types that cannot carry script. `image/svg+xml` is deliberately
 * absent: SVG is a document, not a bitmap, and it holds `<script>` and
 * `onload=`. Browsers disable script for SVG loaded through `<img>`, so this is
 * defence in depth rather than a live hole — but the depth is the point, since
 * nothing here controls which element a future caller renders a URL into.
 */
const SAFE_DATA_TYPE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif)[;,]/i;

/**
 * The scheme, or null when the URL is relative. The pattern is anchored and its
 * alphabet is the scheme grammar itself, so `./a:b.md` and `/path?x=a:b` simply
 * fail to match — no separate path guard is needed, and one that tested the
 * matched run for `/?#` could never fire, since those characters are not in the
 * alphabet that produced it.
 */
function schemeOf(url: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:/i.exec(url);
  return match ? match[0].toLowerCase() : null;
}

/**
 * The URL if it may be rendered, or `""` if it may not.
 *
 * **A string, not a boolean, and the empty string is the whole contract:** the
 * caller is expected to drop the element rather than emit an empty attribute.
 * An `<a>` with no `href` is not a link and an `<img>` with no `src` is not a
 * broken image, which is the intended outcome in both cases — a refused URL
 * should leave nothing behind to click or to report a load error.
 *
 * ```tsx
 * const href = safeUrl(item.url);
 * return href ? <a href={href}>{item.label}</a> : <span>{item.label}</span>;
 * ```
 *
 * A URL with no scheme is relative — `/docs`, `./sibling.md`, `#anchor` — and
 * always allowed: it cannot name a protocol, so it cannot name a dangerous one.
 * Note that this judges the *scheme* and nothing else: a relative path and an
 * `https:` URL to any host both pass, so it is not an origin policy and will
 * not stop a link to somewhere you would rather it did not go.
 */
export function safeUrl(raw: string): string {
  // A URL carrying tab/LF/CR is refused rather than returned. Browsers delete
  // those before parsing, so the string approved here and the string the
  // browser reads would differ.
  if (/[\t\n\r]/.test(raw)) return "";
  let stripped = "";
  for (const char of raw) {
    if (!isIgnoredInScheme(char.codePointAt(0) ?? 0)) stripped += char;
  }
  const scheme = schemeOf(stripped);
  if (scheme === null) return raw.trim();
  if (ALLOWED_SCHEMES.has(scheme)) return raw.trim();
  if (scheme === "data:" && SAFE_DATA_TYPE.test(stripped)) return raw.trim();
  return "";
}
