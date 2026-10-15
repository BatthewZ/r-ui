/** Whether `element` lays out right to left, so a caller can mirror arrow keys and edges. */
export function isRtl(element: Element): boolean {
  return getComputedStyle(element).direction === "rtl";
}
