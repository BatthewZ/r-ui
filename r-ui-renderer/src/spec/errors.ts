/** A thrown value's message: an Error's own, anything else as text. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
