/**
 * JSON Pointers (RFC 6901): the one spelling of a location in a document, used
 * by issue paths, render keys and the stream parser's pending set.
 */

function escapeToken(token: string | number): string {
  return String(token).replaceAll("~", "~0").replaceAll("/", "~1");
}

function unescapeToken(token: string): string {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

/** `pointer` extended by one key or index. */
export function appendPointer(pointer: string, token: string | number): string {
  return `${pointer}/${escapeToken(token)}`;
}

export function toPointer(tokens: readonly (string | number)[]): string {
  return tokens.reduce<string>(appendPointer, "");
}

/** The tokens of `pointer`, or null when it is not a pointer (`""` is the whole document). */
export function parsePointer(pointer: string): string[] | null {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) return null;
  return pointer.slice(1).split("/").map(unescapeToken);
}
