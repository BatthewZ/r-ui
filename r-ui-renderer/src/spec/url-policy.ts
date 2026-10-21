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

/** The base a host's origin (`"https://app.example"`) gives relative URLs; `NO_LOCATION_BASE` when absent or unparsable. */
export function originBase(origin: string | undefined): string {
  if (origin === undefined) return NO_LOCATION_BASE;
  try {
    return `${new URL(origin).origin}/`;
  } catch {
    return NO_LOCATION_BASE;
  }
}

/** Where the page resolves relative URLs: its `<base href>` when it has one (`document.baseURI`). */
function resolutionBase(): string {
  if (typeof document !== "undefined") return document.baseURI;
  return typeof location === "undefined" ? NO_LOCATION_BASE : location.href;
}

/** The page's own address, whose origin the default policies allow: never its `<base href>`. */
function pageBase(): string {
  return typeof location === "undefined" ? NO_LOCATION_BASE : location.href;
}

/**
 * `raw` resolved the way a browser will, against `base` (default: the page's
 * base URL, `<base href>` included), or null when it does not parse or its
 * scheme is refused. Origins are judged on this result, never on how the
 * string starts: `/\evil.test` and `/\t/evil.test` both begin with one slash
 * and leave the origin.
 */
export function resolveUrl(raw: string, base: string = resolutionBase()): URL | null {
  if (safeUrl(raw) === "") return null;
  try {
    return new URL(raw, base);
  } catch {
    return null;
  }
}

/** The default request policy: same origin as `base`, which is the page by default. */
export function defaultAllowUrl(url: URL, base: string = pageBase()): boolean {
  try {
    return url.origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** The default image policy: same origin, or a `data:` raster image. */
export function defaultAllowImageUrl(url: URL, base: string = pageBase()): boolean {
  if (url.protocol === "data:") return SAFE_DATA_TYPE.test(url.href);
  return defaultAllowUrl(url, base);
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
