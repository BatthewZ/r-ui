/**
 * The URL policy, React-free so a server judges URLs as the renderer will.
 *
 * `safeUrl` mirrors the component library's `safeUrl` (this module may not
 * import the library): a scheme allowlist, judged after stripping what a
 * browser ignores inside a scheme. The two are compared over a shared corpus.
 * The origin checks are separate: a scheme can be safe and the origin still
 * not one the document may make the browser contact.
 */

function isIgnoredInScheme(code: number): boolean {
  return (
    code <= 0x20 ||
    (code >= 0x7f && code <= 0xa0) ||
    (code >= 0x200b && code <= 0x200d) ||
    code === 0xfeff
  );
}

const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "mailto:", "tel:"]);

/** `data:` types that cannot carry script; SVG is a document and is not one of them. */
const SAFE_DATA_TYPE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif)[;,]/i;

function schemeOf(url: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:/i.exec(url);
  return match ? match[0].toLowerCase() : null;
}

/** The URL (trimmed) if its scheme may be rendered, else `""`. Relative URLs pass. */
export function safeUrl(raw: string): string {
  // Browsers delete tab/LF/CR before parsing, so the approved string and the read one would differ.
  if (/[\t\n\r]/.test(raw)) return "";
  let stripped = "";
  for (const char of raw) {
    if (!isIgnoredInScheme(char.codePointAt(0) ?? 0)) stripped += char;
  }
  const scheme = schemeOf(stripped);
  if (scheme === null || ALLOWED_SCHEMES.has(scheme)) return raw.trim();
  if (scheme === "data:" && SAFE_DATA_TYPE.test(stripped)) return raw.trim();
  return "";
}

/**
 * Where a relative URL resolves when there is no `location` (a server, a
 * worker, the CLI) and no origin was given. A reserved TLD (RFC 2606), so no
 * real origin a document names can match it.
 */
export const NO_LOCATION_BASE = "https://ssr.invalid/";

function currentBase(): string {
  return typeof globalThis.location === "undefined" ? NO_LOCATION_BASE : globalThis.location.href;
}

/**
 * `raw` resolved the way a browser will, against `base` (default: the page),
 * or null when it does not parse or its scheme is refused. Origins are judged
 * on this result, never on how the string starts: `/\evil.test` and
 * `/\t/evil.test` both begin with one slash and leave the origin.
 */
export function resolveUrl(raw: string, base: string = currentBase()): URL | null {
  if (safeUrl(raw) === "") return null;
  try {
    return new URL(raw, base);
  } catch {
    return null;
  }
}

/** The default request policy: same origin as `base`, which is the page by default. */
export function defaultAllowUrl(url: URL, base: string = currentBase()): boolean {
  try {
    return url.origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** The default image policy: same origin, or a `data:` raster image. */
export function defaultAllowImageUrl(url: URL, base: string = currentBase()): boolean {
  if (url.protocol === "data:") return SAFE_DATA_TYPE.test(url.href);
  return defaultAllowUrl(url, base);
}
