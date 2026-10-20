import { createElement, type ReactNode, use } from "react";

import { DIAGNOSTIC_CLASSES, severityClass } from "../../diagnostics";
import type { IconProps } from "../../spec/types";
import { IconSetContext } from "../icon-context";
import { classes, toneClass } from "./tones";

/**
 * The named icon from the view's icon set (`IconSetContext`) at `size-icon`;
 * `aria-hidden` unless `label` names it. A name the set lacks renders the
 * missing-icon diagnostic.
 */
export function Icon(props: IconProps): ReactNode {
  const { name, label, tone, className } = props;
  const icons = use(IconSetContext);
  const Glyph = icons !== undefined && typeof name === "string" && Object.hasOwn(icons, name) ? icons[name] : undefined;
  if (Glyph === undefined) {
    return createElement("span", {
      className: classes(DIAGNOSTIC_CLASSES.diagnostic, severityClass("warning"), DIAGNOSTIC_CLASSES.missingIcon),
      "data-code": "unknown-icon",
    });
  }
  const look = classes("size-icon shrink-0", toneClass(tone), className);
  return typeof label === "string" && label.length > 0
    ? createElement(Glyph, { className: look, role: "img", "aria-label": label })
    : createElement(Glyph, { className: look, "aria-hidden": true });
}
