/** JSON's whitespace: space, tab, line feed, carriage return. */
export function isJsonWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

const BACKTICK = 0x60;

/**
 * `text` without a surrounding Markdown code fence (```json … ``` or ``` … ```)
 * and the whitespace around it; unchanged when it has none. Each side is
 * judged alone: an opening fence is three or more backticks and the rest of
 * its line, a closing one three or more backticks at the very end. The stream
 * parser accepts exactly what `JSON.parse(stripCodeFence(text))` accepts.
 */
export function stripCodeFence(text: string): string {
  let start = 0;
  let end = text.length;

  let lead = 0;
  while (lead < end && isJsonWhitespace(text.charCodeAt(lead))) lead += 1;
  let ticks = lead;
  while (ticks < end && text.charCodeAt(ticks) === BACKTICK) ticks += 1;
  const lineEnd = ticks - lead >= 3 ? text.indexOf("\n", ticks) : -1;
  if (lineEnd !== -1) {
    start = lineEnd + 1;
    while (start < end && isJsonWhitespace(text.charCodeAt(start))) start += 1;
  }

  let trail = end;
  while (trail > start && isJsonWhitespace(text.charCodeAt(trail - 1))) trail -= 1;
  let open = trail;
  while (open > start && text.charCodeAt(open - 1) === BACKTICK) open -= 1;
  if (trail - open >= 3) {
    end = open;
    while (end > start && isJsonWhitespace(text.charCodeAt(end - 1))) end -= 1;
  }

  return start === 0 && end === text.length ? text : text.slice(start, end);
}
