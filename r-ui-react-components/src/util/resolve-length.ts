/**
 * A CSS length (`var(--R-SIZE-2)`, `calc(var(--CONTROL-H) * 2)`) in px, as it
 * resolves inside `host`, so the density and theme written there move it (a
 * theme may write a token in any unit). The probe is hidden, absolutely placed
 * and removed at once, so it takes no part in layout or overflow; it carries the
 * length as `data-length-probe` for tests that stub layout. Zero where nothing
 * lays out (jsdom).
 */
export function resolveLength(host: Element, length: string): number {
  const probe = host.ownerDocument.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.dataset.lengthProbe = length;
  probe.style.cssText = "position: absolute; visibility: hidden; block-size: 0";
  probe.style.inlineSize = length;
  host.append(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}
