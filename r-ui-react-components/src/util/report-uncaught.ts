/** Hands an error no caller can catch (a background check, a native submit) to the global handler. */
export function reportUncaught(error: unknown): void {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else console.error(error);
}
