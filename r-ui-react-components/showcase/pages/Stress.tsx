import { useEffect } from "react";

import type { PageProps } from "../shell/App";
import { href } from "../shell/router";
import { ContainerPanel } from "./stress/Container";
import { ExtremesPanel } from "./stress/Extremes";
import { FloatingPanel } from "./stress/Floating";
import { LayersPanel } from "./stress/Layers";
import { NestingPanel } from "./stress/Nesting";
import { Panel } from "./stress/parts";
import { VirtualPanel } from "./stress/Virtual";

/**
 * Hostile cases that prove the axes hold. Each panel names its claim, and
 * `scripts/browser/stress-*.js` measure the claims in a real browser.
 */
const PANELS = [
  {
    id: "stress-nesting",
    title: "Density re-derives at every boundary",
    proves:
      "a compact card inside a prose region inside a comfortable page is compact, and a comfortable card inside a compact one is comfortable again: rows, controls and UI text all follow the nearest data-density.",
    Body: NestingPanel,
  },
  {
    id: "stress-floating",
    title: "Floating panels from a clipping compact card",
    proves:
      "a menu, popover, tooltip and select opened inside a compact card with overflow: hidden are compact (they inherit from where they are written) and unclipped (they are in the top layer).",
    Body: FloatingPanel,
  },
  {
    id: "stress-virtual",
    title: "10,000 rows, density flipped while scrolled deep",
    proves:
      "after the table's own density changes mid-scroll, the scroll height is rows × the new --ROW-H + the head, and the rows on screen are the ones the scroll position says (no blank window).",
    Body: VirtualPanel,
  },
  {
    id: "stress-extremes",
    title: "Content extremes",
    proves:
      "unbroken strings, absurd numbers, zero and one rows, 30% longer translations and right-to-left text never break a layout, never print NaN, and never scroll the page sideways.",
    Body: ExtremesPanel,
  },
  {
    id: "stress-layers",
    title: "Stacked layers",
    proves:
      "many toasts at once, a dialog over a drawer and a menu inside a dialog all stack in the top layer, and each stays interactive while it is on top.",
    Body: LayersPanel,
  },
  {
    id: "stress-container",
    title: "Container-width playground",
    proves:
      "a StatCard, Table and Pagination adapt to the width of the box they sit in, not the viewport: drag the box narrower on a wide screen and they step down.",
    Body: ContainerPanel,
  },
] as const;

export function Stress({ anchor }: PageProps) {
  useEffect(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }, [anchor]);

  return (
    <div className="sc-page">
      <header className="sc-page-head">
        <h1>Stress</h1>
        <p className="sc-lede">
          Hostile cases that prove the axes hold. Flip theme, density and input from View; every panel
          says what it proves, and the browser checks measure it.
        </p>
      </header>

      <nav className="sc-toc" aria-label="On this page">
        <ul>
          {PANELS.map((p) => (
            <li key={p.id}>
              <a href={href("stress", p.id)}>{p.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      {PANELS.map(({ id, title, proves, Body }) => (
        <Panel key={id} id={id} title={title} proves={proves}>
          <Body />
        </Panel>
      ))}
    </div>
  );
}
