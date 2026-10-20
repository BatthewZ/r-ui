// @covers   marketing/Hero, motion/Parallax
// @sections marketing-hero
// @tier     component
//
// Browser check: Hero's `backdrop` is a decorative layer that covers the hero, is clipped
// to it, paints under the content, takes no press and no focus, and lets a view timeline
// inside it (the showcase composes a `Parallax`) follow the page.
//
// jsdom has no layout, paint order, clipping or scroll timelines.
//
// Run it through `bun run browser:check marketing-hero-backdrop`.
//
// On the Hero section (`#marketing-hero`, its frame `open`) with a viewport of runway above
// and below, the backdrop demo (`[data-sc="hero-backdrop"]`):
//   1. harness: the browser has `animation-timeline: view()`, the layer runs
//      `r-motion-parallax-drift`, `--PARALLAX-SHIFT` is over 0;
//   2. the backdrop is `aria-hidden`, `inert`, `pointer-events: none`, absolutely placed on
//      the hero's padding box (±0.5px), and the Parallax box fills it;
//   3. clipped: `overflow` is `clip` on both axes (not `hidden`: that is a scroll container
//      and would stop the drift); with the demo frame's own clip lifted, a probe taller than
//      the hero placed in the backdrop does not hit-test above the hero's top edge, and does
//      inside it (the positive control);
//   4. under the content: with the backdrop made hit-testable for a moment, the title and
//      the first action still hit-test to themselves (hit testing follows paint order) while
//      a free point hits the backdrop (the positive control); restored, a free point hits the
//      hero, never the backdrop, and a real mouse press on the action reaches the button;
//   5. the Parallax inside drifts: at four scroll positions across its `cover` range the
//      layer's `translate` is shift × (2p − 1) (±2px, p from geometry) and grows as the page
//      scrolls down, and the layer runs past the hero at mid-scroll (so 3's clip has work);
//   6. under reduced motion the layer's translate is 0 at two positions;
//   7. under forced colours the backdrop is not displayed (it is otherwise), nor in print;
//   8. at 375 (compact + coarse) the backdrop still covers the hero and nothing scrolls
//      sideways;
//   9. no console or page error.
//
// Suggested breaks: drop `relative` from the Hero's Container (4 fails: the backdrop paints
// over the title); make `.r-marketing-hero-backdrop` `overflow: hidden` (3 and 5 fail: the
// layer holds still) or `visible` (3 fails); drop `frame: "open"` from the section's meta
// (5 fails: the demo frame is the timeline's scroller); drop `inert` from the backdrop (2 fails).
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const DEMO = '[data-sc="hero-backdrop"]';

  const load = async ({ width = 1280, reduced = false, forced = false, view = {} } = {}) => {
    await openSection(page, "marketing-hero", {
      view: { theme: "default", density: "comfortable", input: "fine", ...view },
      width,
      reduced,
      forced,
      runway: true,
    });
    await page.locator(`${DEMO} .r-marketing-hero-backdrop`).waitFor({ state: "attached" });
  };

  /** The demo's parts and the hero's padding box, after scrolling its top to `top` px. */
  const read = (top) =>
    page.evaluate(async ({ DEMO, top }) => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      const hero = document.querySelector(`${DEMO} section`);
      window.scrollBy(0, hero.getBoundingClientRect().top - top);
      await frame();
      await frame();
      const backdrop = hero.querySelector(":scope > .r-marketing-hero-backdrop");
      const box = backdrop.querySelector(".r-motion-parallax");
      const layer = box.querySelector(".r-motion-parallax-layer");
      const h = hero.getBoundingClientRect();
      const pad = { top: h.top + hero.clientTop, left: h.left + hero.clientLeft, width: hero.clientWidth, height: hero.clientHeight };
      const rect = (el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom };
      };
      const [, ty = "0px"] = getComputedStyle(layer).translate.split(" ");
      return { pad, backdrop: rect(backdrop), box: rect(box), layer: rect(layer), ty: Number.parseFloat(ty), viewport: innerHeight };
    }, { DEMO, top });

  const covers = (a, b) => ["top", "left", "width", "height"].every((k) => Math.abs(a[k] - b[k]) <= 0.5);
  let shift = 0;

  try {
    // 1. Harness, and 2. the layer's attributes and placement.
    await load();
    const harness = await page.evaluate((DEMO) => {
      const hero = document.querySelector(`${DEMO} section`);
      const backdrop = hero?.querySelector(":scope > .r-marketing-hero-backdrop");
      const layer = backdrop?.querySelector(".r-motion-parallax-layer");
      const probe = document.createElement("div");
      probe.style.blockSize = "var(--PARALLAX-SHIFT)";
      hero.append(probe);
      const shift = probe.getBoundingClientRect().height;
      probe.remove();
      const cs = backdrop && getComputedStyle(backdrop);
      return {
        found: Boolean(hero && backdrop && layer),
        supports: window.CSS.supports("animation-timeline: view()"),
        animation: layer && getComputedStyle(layer).animationName,
        shift,
        ariaHidden: backdrop?.getAttribute("aria-hidden"),
        inert: backdrop?.hasAttribute("inert"),
        pointer: cs?.pointerEvents,
        position: cs?.position,
        overflow: cs && `${cs.overflowX} ${cs.overflowY}`,
        display: cs?.display,
      };
    }, DEMO);
    if (!harness.found) throw new Error(`marketing-hero-backdrop FAILED: harness: no hero with a Parallax backdrop in ${DEMO}`);
    shift = harness.shift;
    if (!harness.supports) fail.push("harness: this browser has no scroll-driven animations; the drift cannot be measured");
    if (harness.animation !== "r-motion-parallax-drift") fail.push(`harness: the layer runs ${harness.animation}, not r-motion-parallax-drift`);
    if (!(shift > 0)) fail.push(`harness: --PARALLAX-SHIFT measured ${shift}px`);
    if (harness.ariaHidden !== "true" || !harness.inert) fail.push(`the backdrop is not aria-hidden and inert: ${JSON.stringify(harness)}`);
    if (harness.pointer !== "none") fail.push(`the backdrop takes pointers (pointer-events: ${harness.pointer})`);
    if (harness.position !== "absolute") fail.push(`the backdrop is position: ${harness.position}, not absolute`);
    if (harness.display === "none") fail.push("harness: the backdrop is not displayed on screen");

    const placed = await read(120);
    if (!covers(placed.backdrop, placed.pad)) fail.push(`the backdrop ${JSON.stringify(placed.backdrop)} does not cover the hero's padding box ${JSON.stringify(placed.pad)}`);
    if (!covers(placed.box, placed.backdrop)) fail.push(`the Parallax box ${JSON.stringify(placed.box)} does not fill the backdrop ${JSON.stringify(placed.backdrop)}`);

    // 3. Clipped to the hero (with the demo frame's own clip lifted, so only the hero's can hold).
    if (harness.overflow !== "clip clip") fail.push(`the backdrop's overflow is "${harness.overflow}", not "clip clip"`);
    const clip = await page.evaluate((DEMO) => {
      const frameEl = document.querySelector(DEMO);
      const hero = frameEl.querySelector("section");
      const backdrop = hero.querySelector(":scope > .r-marketing-hero-backdrop");
      frameEl.style.overflow = "visible";
      backdrop.removeAttribute("inert");
      backdrop.style.pointerEvents = "auto";
      const probe = Object.assign(document.createElement("div"), { id: "sc-hero-clip-probe" });
      Object.assign(probe.style, { position: "absolute", insetBlock: "-48px", insetInline: "0", pointerEvents: "auto" });
      backdrop.append(probe);
      const h = hero.getBoundingClientRect();
      const x = h.left + 2;
      const above = document.elementFromPoint(x, h.top - 4);
      const inside = document.elementFromPoint(x, h.top + 4);
      const result = { aboveIsProbe: above === probe, insideIsProbe: inside === probe, heroTop: h.top };
      probe.remove();
      backdrop.style.pointerEvents = "";
      backdrop.setAttribute("inert", "");
      frameEl.style.overflow = "";
      return result;
    }, DEMO);
    if (clip.heroTop < 8) fail.push(`harness: the hero's top (${clip.heroTop}px) is too near the viewport's to probe above it`);
    if (!clip.insideIsProbe) fail.push("harness: the clip probe does not hit-test inside the hero");
    if (clip.aboveIsProbe) fail.push("the backdrop is not clipped to the hero: its probe hit-tests above the hero's top edge");

    // 4. Under the content: hit testing follows paint order.
    const paint = await page.evaluate((DEMO) => {
      const hero = document.querySelector(`${DEMO} section`);
      const backdrop = hero.querySelector(":scope > .r-marketing-hero-backdrop");
      const title = hero.querySelector("h2");
      const button = hero.querySelector("button");
      const centre = (el) => {
        const r = el.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      };
      // In the hero's own top padding, beside nothing of the content's.
      const h = hero.getBoundingClientRect();
      const free = [h.left + 4, h.top + 4];
      const hits = () => ({
        title: title.contains(document.elementFromPoint(...centre(title))),
        button: button.contains(document.elementFromPoint(...centre(button))),
        free: document.elementFromPoint(...free),
      });
      backdrop.removeAttribute("inert");
      backdrop.style.pointerEvents = "auto";
      const probed = hits();
      backdrop.style.pointerEvents = "";
      backdrop.setAttribute("inert", "");
      const real = hits();
      return {
        probed: { title: probed.title, button: probed.button, freeIsBackdrop: backdrop.contains(probed.free) },
        real: { title: real.title, button: real.button, freeInHero: hero.contains(real.free), freeInBackdrop: backdrop.contains(real.free) },
      };
    }, DEMO);
    if (!paint.probed.freeIsBackdrop) fail.push("harness: the backdrop made hit-testable does not take a free point, so the paint-order probe proves nothing");
    if (!paint.probed.title || !paint.probed.button) fail.push(`the backdrop paints over the content: ${JSON.stringify(paint.probed)}`);
    if (!paint.real.title || !paint.real.button || !paint.real.freeInHero || paint.real.freeInBackdrop) fail.push(`hit tests over the hero: ${JSON.stringify(paint.real)}`);

    await page.evaluate((DEMO) => {
      const button = document.querySelector(`${DEMO} section button`);
      window.__scHeroPress = null;
      document.addEventListener("click", (event) => (window.__scHeroPress = button.contains(event.target)), { capture: true, once: true });
    }, DEMO);
    const action = await page.locator(`${DEMO} section button`).first().boundingBox();
    await page.mouse.click(action.x + action.width / 2, action.y + action.height / 2);
    const pressed = await page.evaluate(() => window.__scHeroPress);
    if (pressed !== true) fail.push(`a mouse press on the hero's action reached ${pressed === null ? "nothing" : "another element"}`);

    // 5. The Parallax drifts with the page: entering at the bottom, a quarter, half, nearly gone.
    const samples = [];
    for (const frac of [0.85, 0.55, 0.25, -0.2]) samples.push(await read(Math.round(900 * frac)));
    for (const s of samples) {
      const progress = (s.viewport - s.box.top) / (s.viewport + s.box.height);
      const expected = shift * (2 * Math.min(1, Math.max(0, progress)) - 1);
      if (Math.abs(s.ty - expected) > 2) fail.push(`hero top ${s.box.top.toFixed(0)}: layer translate ${s.ty.toFixed(1)}px, expected ${expected.toFixed(1)}px`);
    }
    for (let i = 1; i < samples.length; i++) {
      if (!(samples[i].ty > samples[i - 1].ty)) {
        fail.push(`the backdrop does not drift with the page: translate ${samples.map((s) => s.ty.toFixed(1)).join(" → ")}`);
        break;
      }
    }
    const mid = samples.reduce((best, s) => (Math.abs(s.ty) < Math.abs(best.ty) ? s : best));
    if (!(mid.layer.top < mid.pad.top - 0.5 || mid.layer.bottom > mid.pad.top + mid.pad.height + 0.5)) {
      fail.push(`harness: the layer stays inside the hero at mid-scroll (${mid.layer.top.toFixed(1)}…${mid.layer.bottom.toFixed(1)}), so the clip is untested`);
    }

    // 6. Reduced motion holds it still.
    await load({ reduced: true });
    for (const top of [700, 100]) {
      const s = await read(top);
      if (Math.abs(s.ty) > 0.01) fail.push(`reduced motion: hero top ${s.box.top.toFixed(0)}: layer translate ${s.ty}px, expected 0`);
    }

    // 7. Forced colours and print drop the decoration.
    const display = () => page.evaluate((DEMO) => getComputedStyle(document.querySelector(`${DEMO} .r-marketing-hero-backdrop`)).display, DEMO);
    await load({ forced: true });
    const forced = await display();
    if (forced !== "none") fail.push(`forced colours: the backdrop is displayed (${forced})`);
    await load();
    await page.emulateMedia({ media: "print" });
    const printed = await display();
    await page.emulateMedia({ media: null });
    if (printed !== "none") fail.push(`print: the backdrop is displayed (${printed})`);

    // 8. Narrow, compact and coarse.
    await load({ width: 375, view: { density: "compact", input: "coarse" } });
    const narrow = await read(120);
    if (!covers(narrow.backdrop, narrow.pad)) fail.push(`375: the backdrop ${JSON.stringify(narrow.backdrop)} does not cover the hero ${JSON.stringify(narrow.pad)}`);
    const spill = await page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth);
    if (spill > 0) fail.push(`375: the page scrolls ${spill}px sideways`);
  } finally {
    stopErrors();
  }

  for (const e of errors) fail.push(e);
  if (fail.length) throw new Error(`marketing-hero-backdrop FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
  return `marketing-hero-backdrop OK (covers and clips to the hero, under the content and pressed through, drifts ±${shift}px with the page, still under reduced motion, gone in forced colours and print)`;
}
