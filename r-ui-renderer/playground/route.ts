/**
 * The playground's two routes. `/` is the playground; `/?view=<name>` renders
 * one corpus document full-page with no chrome, which is what the browser
 * checks drive:
 *
 *   view=<name>                 a file stem in src/examples/ or src/examples/coverage/
 *   theme=<name>                <html data-theme> (any name; the default theme when absent)
 *   density=comfortable|compact the host density (ViewRenderer's `density`)
 *   input=coarse|fine           <html data-input> (auto when absent)
 *   stream=<chars per frame>    replays the document's text through the stream
 *                               parser, one push per animation frame; 0 = all at once
 *
 * A value outside these is a route error, never ignored, so a check never
 * measures a view it did not ask for.
 */
import { DENSITIES, type Density } from "../src/spec/types";

export const INPUTS = ["coarse", "fine"] as const;
export type Input = (typeof INPUTS)[number];

export interface ViewRoute {
  readonly kind: "view";
  readonly name: string;
  readonly theme?: string;
  readonly density?: Density;
  readonly input?: Input;
  /** Characters per animation frame; absent: the document whole, not streamed. */
  readonly stream?: number;
}

export type Route =
  | { readonly kind: "playground" }
  | ViewRoute
  | { readonly kind: "invalid"; readonly message: string };

function oneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function parseRoute(search: string): Route {
  const params = new URLSearchParams(search);
  const name = params.get("view");
  if (name === null) return { kind: "playground" };
  const invalid = (message: string): Route => ({ kind: "invalid", message });
  if (name === "") return invalid("`view` names no document.");

  let route: ViewRoute = { kind: "view", name };
  const theme = params.get("theme");
  if (theme !== null) {
    if (theme.trim() === "") return invalid("`theme` is empty.");
    route = { ...route, theme };
  }
  const density = params.get("density");
  if (density !== null) {
    if (!oneOf(density, DENSITIES)) return invalid(`\`density\` is "${density}", not one of ${DENSITIES.join(", ")}.`);
    route = { ...route, density };
  }
  const input = params.get("input");
  if (input !== null) {
    if (!oneOf(input, INPUTS)) return invalid(`\`input\` is "${input}", not one of ${INPUTS.join(", ")}.`);
    route = { ...route, input };
  }
  const stream = params.get("stream");
  if (stream !== null) {
    if (!/^\d+$/.test(stream)) return invalid(`\`stream\` is "${stream}", not a whole number of characters per frame.`);
    route = { ...route, stream: Number(stream) };
  }
  return route;
}

/** Sets the route's page axes on `root`; an axis the route leaves out is removed, so nothing saved leaks in. */
export function applyViewAxes(route: ViewRoute, root: HTMLElement): void {
  if (route.theme === undefined) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", route.theme);
  if (route.input === undefined) root.removeAttribute("data-input");
  else root.setAttribute("data-input", route.input);
  root.removeAttribute("data-density");
}
