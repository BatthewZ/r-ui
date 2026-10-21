import { createElement, type ReactNode, use } from "react";

import { RENDERER_CLASSES, diagnosticAttributes } from "../../diagnostics";
import type { IconProps } from "../../spec/types";
import { glyphFor, IconSetContext } from "../icon-context";
import { classes, toneClass } from "./tones";

/**
 * The named icon from the view's icon set (`IconSetContext`) at the icon size;
 * `aria-hidden` unless `label` names it. A name the set lacks renders the
 * missing-icon diagnostic.
 */
export function Icon(props: IconProps): ReactNode {
  const { name, label, tone, className } = props;
  const Glyph = glyphFor(use(IconSetContext), name);
  if (Glyph === undefined) {
    return createElement("span", diagnosticAttributes({ code: "unknown-icon", severity: "warning" }, RENDERER_CLASSES.missingIcon));
  }
  const look = classes(RENDERER_CLASSES.icon, toneClass(tone), className);
  return typeof label === "string" && label.length > 0
    ? createElement(Glyph, { className: look, role: "img", "aria-label": label })
    : createElement(Glyph, { className: look, "aria-hidden": true });
}
