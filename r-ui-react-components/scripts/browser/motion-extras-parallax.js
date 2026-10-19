// @covers   motion/Parallax
// @sections motion-parallax motion-countup motion-readingprogress motion-scrollreveal motion-spotlight motion-stagger motion-viewtransition
// @tier     component
//
// Browser check: Parallax drifts on a CSS view timeline, with no script and no scroll
// handler, never moves layout or hit areas, and holds still under reduced motion. Also the
// group-wide claim that no motion component registers a scroll listener where the browser
// has scroll-driven animations (the first load mounts every motion section).
//
// jsdom has no layout, no CSS and no scroll timelines; the drift is a question of painted
// geometry while a real page scrolls.
//
// Run it through `bun run browser:check motion-extras-parallax`.
//
// In a page of its own (so the addEventListener recorder never reaches another check), on
// the Parallax section (`#motion-parallax`) opened with a viewport of runway above and below
// (the first load followed by every other motion section), first hero
// (`[data-sc="parallax-hero"]`):
//   1. harness: the browser has `animation-timeline: view()`; the layer runs
//      `r-motion-parallax-drift`; the shift (a probe sized `--PARALLAX-SHIFT`, the medium
//      strength, by default `--MOTION-DISTANCE-LG` × 4) is over 0; the layer is the box's height plus twice the shift (±1px);
//   2. at four scroll positions across the box's `cover` range the layer's computed
//      `translate` is shift × (2p − 1) (±2px), p predicted from the box's rect and the
//      viewport, and it grows as the page scrolls down (the layer trails the page);
//   3. at every position the layer still covers the box (no edge uncovered), the box and
//      the text panel keep their offset inside the section (layout never moves), and a
//      press anywhere on the box's free area hit-tests to the section, never to the
//      layer or its picture; the box is `aria-hidden` and `inert`;
//   4. scroll listeners, recorded with their stacks from before the app's first line: some
//      are recorded (positive control: a probe's own), none from `src/components/motion/`
//      (in a build, each frame's chunk position read back through its source map, and
//      every one resolved);
//   5. under reduced motion the layer's translate is 0 at two positions and the layer is
//      the box's own height (`--PARALLAX-SHIFT` is 0), also with a theme's override of the
//      token (`:root:root { --PARALLAX-SHIFT: 5rem }`), which without reduced motion does
//      move it (the layer grows by 2 × 5rem: the positive control);
//   6. at 375 (compact + coarse) the page and the section scroll nothing sideways;
//   7. no console or page error.
//
// Suggested break: drop `animation-timeline` from `.r-motion-parallax-layer` (2 fails: the
// layer runs on the document timeline instead), or swap the keyframes' signs (2 fails:
// the layer leads the page).
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const p = await page.context().newPage();
  try {
    const { errors, stop: stopErrors } = collectErrors(p);
    // Every scroll listener, with the module that added it, from before any app code runs.
    await p.addInitScript(() => {
      const seen = (window.__scListeners = []);
      const add = window.EventTarget.prototype.addEventListener;
      window.EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (type === "scroll") seen.push(String(new Error().stack));
        return add.call(this, type, listener, options);
      };
    });

    // `openSection` loads on the page's own origin; a new page starts on about:blank.
    await p.goto(`${base}${SHOWCASE_BLANK}`);
    const MOTION = ["motion-parallax", "motion-countup", "motion-readingprogress", "motion-scrollreveal", "motion-spotlight", "motion-stagger", "motion-viewtransition"];
    const load = async ({ width = 1280, reduced = false, view = {}, ids = "motion-parallax" } = {}) => {
      await openSection(p, ids, {
        view: { theme: "default", density: "comfortable", input: "fine", ...view },
        width,
        reduced,
        runway: true,
      });
      await p.locator('[data-sc="parallax-hero"]').first().waitFor({ state: "attached" });
    };

    /** Scrolls so the first hero's top sits at `top` px in the viewport, then reads it two frames on. */
    const at = (top) =>
      p.evaluate(async (wanted) => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
        const hero = document.querySelector('[data-sc="parallax-hero"]');
        const box = hero.querySelector('[data-sc="parallax"]');
        const layer = box.querySelector(".r-motion-parallax-layer");
        const panel = hero.querySelector(":scope > div.relative");
        window.scrollBy(0, hero.getBoundingClientRect().top - wanted);
        await frame();
        await frame();
        const h = hero.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        const l = layer.getBoundingClientRect();
        const pa = panel.getBoundingClientRect();
        const [, ty = "0px"] = getComputedStyle(layer).translate.split(" ");
        // A free point: inside the box, beside the panel.
        const fx = (b.left + pa.left) / 2;
        const fy = b.top + b.height / 2;
        const hit = fy > 0 && fy < innerHeight ? document.elementFromPoint(fx, fy) : null;
        return {
          top: b.top,
          height: b.height,
          viewport: innerHeight,
          ty: Number.parseFloat(ty),
          layerTop: l.top,
          layerBottom: l.bottom,
          layerHeight: l.height,
          boxBottom: b.bottom,
          boxInHero: b.top - h.top,
          panelInHero: pa.top - h.top,
          hit: hit ? { inLayer: box.contains(hit), isHero: hit === hero || hero.contains(hit) } : null,
        };
      }, top);

    await load({ ids: MOTION });
    const harness = await p.evaluate(() => {
      const hero = document.querySelector('[data-sc="parallax-hero"]');
      const box = hero.querySelector('[data-sc="parallax"]');
      const layer = box.querySelector(".r-motion-parallax-layer");
      const measure = (value) => {
        const probe = document.createElement("div");
        probe.style.blockSize = value;
        box.parentElement.append(probe);
        const height = probe.getBoundingClientRect().height;
        probe.remove();
        return height;
      };
      const shift = measure("var(--PARALLAX-SHIFT)");
      return {
        derived: measure("calc(var(--MOTION-DISTANCE-LG) * 4)"),
        supports: window.CSS.supports("animation-timeline: view()"),
        animation: getComputedStyle(layer).animationName,
        shift,
        ariaHidden: box.getAttribute("aria-hidden"),
        inert: box.hasAttribute("inert"),
      };
    });
    const { shift } = harness;
    if (!harness.supports) fail.push("harness: this browser has no scroll-driven animations; the check cannot measure the drift");
    if (harness.animation !== "r-motion-parallax-drift") fail.push(`harness: the layer runs ${harness.animation}, not r-motion-parallax-drift`);
    if (!(shift > 0)) fail.push(`harness: --PARALLAX-SHIFT measured ${shift}px`);
    // The token's default, predicted from source: the contract's reveal distance × 4.
    if (Math.abs(shift - harness.derived) > 0.5) fail.push(`harness: --PARALLAX-SHIFT is ${shift}px, not --MOTION-DISTANCE-LG × 4 (${harness.derived}px)`);
    if (harness.ariaHidden !== "true" || !harness.inert) fail.push(`the box is not hidden and inert: ${JSON.stringify(harness)}`);

    // Across the cover range: entering at the bottom, a quarter, half, and nearly leaving at the top.
    const samples = [];
    for (const frac of [0.85, 0.55, 0.25, -0.2]) samples.push(await at(Math.round(900 * frac)));
    for (const s of samples) {
      const progress = (s.viewport - s.top) / (s.viewport + s.height);
      const expected = shift * (2 * Math.min(1, Math.max(0, progress)) - 1);
      if (Math.abs(s.ty - expected) > 2) fail.push(`box top ${s.top.toFixed(0)}: layer translate ${s.ty.toFixed(1)}px, expected ${expected.toFixed(1)}px`);
      if (Math.abs(s.layerHeight - (s.height + 2 * shift)) > 1) fail.push(`box top ${s.top.toFixed(0)}: layer ${s.layerHeight.toFixed(1)}px tall, expected the box's ${s.height.toFixed(1)} + 2 × ${shift}`);
      if (s.layerTop > s.top + 0.5 || s.layerBottom < s.boxBottom - 0.5) fail.push(`box top ${s.top.toFixed(0)}: the layer uncovers the box (${s.layerTop.toFixed(1)}…${s.layerBottom.toFixed(1)} vs ${s.top.toFixed(1)}…${s.boxBottom.toFixed(1)})`);
      if (s.hit && (s.hit.inLayer || !s.hit.isHero)) fail.push(`box top ${s.top.toFixed(0)}: a press on the free area hit ${JSON.stringify(s.hit)}`);
    }
    if (samples.filter((s) => s.hit).length === 0) fail.push("harness: no sample had its free point on screen to hit-test");
    for (let i = 1; i < samples.length; i++) {
      if (!(samples[i].ty > samples[i - 1].ty)) fail.push(`the layer does not trail the page: translate ${samples.map((s) => s.ty.toFixed(1)).join(" → ")}`);
      if (Math.abs(samples[i].boxInHero - samples[0].boxInHero) > 0.5 || Math.abs(samples[i].panelInHero - samples[0].panelInHero) > 0.5) {
        fail.push(`layout moved while scrolling: box ${samples.map((s) => s.boxInHero).join("/")}, panel ${samples.map((s) => s.panelInHero).join("/")}`);
      }
    }

    // Each stack frame named by its source file: a dev server serves the sources
    // themselves; a build's chunk is read back through its source map.
    const listeners = await p.evaluate(async () => {
      window.addEventListener("scroll", () => {}, { passive: true });
      const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      /** Per generated line, each segment's [column, source index] (VLQ, every field a running delta). */
      const decode = (mappings) => {
        let source = 0;
        return mappings.split(";").map((line) => {
          let column = 0;
          const segments = [];
          for (const segment of line.split(",").filter(Boolean)) {
            const fields = [];
            let value = 0;
            let shift = 0;
            for (const ch of segment) {
              const digit = B64.indexOf(ch);
              value += (digit & 31) << shift;
              if (digit & 32) shift += 5;
              else {
                fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
                value = shift = 0;
              }
            }
            column += fields[0];
            if (fields.length > 1) segments.push([column, (source += fields[1])]);
          }
          return segments;
        });
      };
      const maps = new Map();
      const sourceOf = async (file, line, column) => {
        if (!/\/assets\/[^/]+\.js$/.test(file)) return file;
        if (!maps.has(file)) maps.set(file, fetch(`${file}.map`).then((r) => (r.ok ? r.json() : null)).then((m) => m && { sources: m.sources, lines: decode(m.mappings) }));
        const map = await maps.get(file);
        let index = null;
        for (const [at, source] of map?.lines[line - 1] ?? []) if (at <= column - 1) index = source;
        return index === null ? null : map.sources[index];
      };
      const all = await Promise.all(
        window.__scListeners.map(async (stack) => {
          const frames = [...stack.matchAll(/(https?:\/\/[^\s()]+?):(\d+):(\d+)/g)];
          return { stack, sources: await Promise.all(frames.map(([, file, line, column]) => sourceOf(file, Number(line), Number(column)))) };
        }),
      );
      const chunkFrames = all.flatMap((l) => l.stack.match(/\/assets\/[^\s():]+\.js:\d+:\d+/g) ?? []).length;
      return {
        count: all.length,
        chunkFrames,
        unresolved: all.reduce((n, l) => n + l.sources.filter((src) => src === null).length, 0),
        motion: all.flatMap((l) => l.sources.find((src) => src?.includes("/src/components/motion/")) ?? []),
      };
    });
    if (listeners.count < 1) fail.push("harness: the addEventListener recorder saw no scroll listener, not even its own probe's");
    if (listeners.unresolved) fail.push(`harness: ${listeners.unresolved} stack frame(s) in a built chunk found no source in its map`);
    if (BROWSER_CHECK_BUILT && listeners.chunkFrames === 0) fail.push("harness: in the build no scroll listener came from a chunk, so no source map was read");
    if (listeners.motion.length) fail.push(`a motion component registered ${listeners.motion.length} scroll listener(s), from ${[...new Set(listeners.motion)].join(", ")}`);

    await load({ reduced: true });
    const still = [await at(700), await at(100)];
    // A theme that retunes the token (a selector above `:root`, as `:root[data-theme]` is) is still held at 0.
    const themed = (on) =>
      p.evaluate((on) => {
        document.getElementById("sc-parallax-theme")?.remove();
        if (!on) return;
        const style = Object.assign(document.createElement("style"), { id: "sc-parallax-theme" });
        style.textContent = ":root:root { --PARALLAX-SHIFT: 5rem; }";
        document.head.append(style);
      }, on);
    await themed(true);
    still.push(await at(400));
    await themed(false);
    for (const s of still) {
      if (Math.abs(s.ty) > 0.01) fail.push(`reduced motion: box top ${s.top.toFixed(0)}: layer translate ${s.ty}px, expected 0`);
      if (Math.abs(s.layerHeight - s.height) > 0.5) fail.push(`reduced motion: the layer is ${s.layerHeight}px for a ${s.height}px box (the shift should be 0)`);
    }

    // Positive control for the theme lever: without reduced motion the same override moves the drift.
    await load();
    await themed(true);
    const retuned = await p.evaluate(() => {
      const box = document.querySelector('[data-sc="parallax-hero"] [data-sc="parallax"]');
      const layer = box.querySelector(".r-motion-parallax-layer");
      return { layer: layer.getBoundingClientRect().height, box: box.getBoundingClientRect().height, rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize) };
    });
    if (Math.abs(retuned.layer - (retuned.box + 2 * 5 * retuned.rem)) > 1) fail.push(`a theme's --PARALLAX-SHIFT: 5rem grows the layer to ${retuned.layer}px, expected the box's ${retuned.box} + 2 × 5rem`);

    await load({ width: 375, view: { density: "compact", input: "coarse" } });
    const narrow = await p.evaluate(() => {
      const section = document.getElementById("motion-parallax");
      return {
        found: Boolean(section),
        page: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
        section: section ? section.scrollWidth - section.clientWidth : null,
      };
    });
    if (!narrow.found) fail.push("harness: no #motion-parallax section at 375");
    if (narrow.page > 0 || narrow.section > 0) fail.push(`375: sideways scroll ${JSON.stringify(narrow)}`);
    stopErrors();
    if (errors.length) fail.push(...errors);
    const result = { shift, samples: samples.map((s) => [Math.round(s.top), Number(s.ty.toFixed(1))]), listeners: listeners.count, narrow };
    if (fail.length) throw new Error(`motion-extras-parallax FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
    return `motion-extras-parallax OK the layer trails the page by ±${shift}px (${result.samples.map(([t, y]) => `${t}:${y}`).join(" ")}), covers its box, never takes a press or moves layout; no motion scroll listener among ${listeners.count}; still under reduced motion; no spill at 375`;
  } finally {
    await p.close();
  }
}
