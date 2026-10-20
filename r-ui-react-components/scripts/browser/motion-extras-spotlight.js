// @covers   motion/Spotlight
// @sections motion-spotlight
// @tier     component
//
// Browser check: Spotlight follows a fine pointer across a card, keeps every text in the card
// at its contrast floor over the wash in every theme, and is absent on touch, a coarse
// input, reduced motion, forced colours and paper.
//
// jsdom has no pointer geometry, no media queries and no painted colour.
//
// Run it through `bun run browser:check motion-extras-spotlight`.
//
// On the Spotlight section (`#motion-spotlight`), opened alone, first card
// (`[data-sc="spotlight-card"]`):
//   1. harness: `(hover: hover) and (pointer: fine)` matches; at rest the card's computed
//      `background-image` is `none`; `--r-motion-spotlight-x/-y` are registered: at rest the
//      card computes their initial value, 0.5 (unregistered, they compute to nothing);
//   2. a real mouse at 25% × 40% of the card, then at 75% × 60%: two frames on, the card is
//      `data-spotlight="on"`, `--r-motion-spotlight-x/-y` are those shares (±0.01) inline and
//      computed, the computed `background-image` is a radial gradient centred there (±1%),
//      and every element inside the card still computes 0.5 for both (they do not inherit,
//      so a move restyles the card alone); leaving puts it out (`none`);
//   3. contrast, in every listed theme: each text in the card that sits on the card's own
//      fill (not on a button's) reads at 4.5:1 or better over the card's background with the
//      gradient's centre colour composited on it (both resolved by a canvas, so any colour
//      space works), wherever it read 4.5:1 without it; the wash changes the paint (positive
//      control: the composite differs from the background);
//   4. a synthetic touch `pointermove` (pointerType "touch") lights nothing;
//   5. the View's coarse input (`data-input="coarse"`) and, in a second, touch-enabled
//      context (really `(pointer: coarse)` + `(hover: none)`; CDP's media emulation
//      ignores both), a mouse over the card paints `none` (in the touch context, though
//      the script lit it);
//   6. reduced motion (reloaded): a mouse over the card sets no `data-spotlight` and paints
//      `none`; forced colours and print (emulated, while lit): `none`;
//   7. at 375 (compact + coarse) nothing in the section scrolls sideways;
//   8. no console or page error.
//
// Suggested break: drop `(prefers-reduced-motion: no-preference)` from the stylesheet's
// query AND the `reduced` early return in Spotlight (6 fails), raise the wash to 12%
// (3 fails on a muted line in a dark theme), or set `inherits: true` on the two
// `@property` rules (2 fails: the card's children read the pointer's shares; deleting the
// rules fails 1 as well).
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const CARD = '[data-sc="spotlight-card"]';

  const load = async ({ width = 1280, reduced = false, view = {} } = {}) => {
    await openSection(page, "motion-spotlight", { view: { theme: "default", density: "comfortable", input: "fine", ...view }, width, reduced });
    await page.locator(CARD).first().scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1);
  };
  /** Moves a real mouse to (fx, fy) of the first card and reads it two frames on. */
  const hover = async (fx, fy) => {
    const box = await page.locator(CARD).first().boundingBox();
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy, { steps: 3 });
    return read();
  };
  const read = () =>
    page.evaluate(async (sel) => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      await frame();
      await frame();
      const card = document.querySelector(sel);
      const css = getComputedStyle(card);
      const computed = (el) => ["x", "y"].map((a) => getComputedStyle(el).getPropertyValue(`--r-motion-spotlight-${a}`).trim());
      const inside = [...card.querySelectorAll("*")];
      return {
        on: card.getAttribute("data-spotlight"),
        x: Number(card.style.getPropertyValue("--r-motion-spotlight-x")),
        y: Number(card.style.getPropertyValue("--r-motion-spotlight-y")),
        computed: computed(card),
        descendants: inside.length,
        inherited: inside.map(computed).filter((v) => v.some((n) => n === "" || Number(n) !== 0.5)).slice(0, 3),
        image: css.backgroundImage,
      };
    }, CARD);
  const centre = (image) => {
    const m = /at ([\d.]+)% ([\d.]+)%/.exec(image);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };

  await load();
  const harness = await page.evaluate((sel) => {
    const css = getComputedStyle(document.querySelector(sel));
    return {
      fine: matchMedia("(hover: hover) and (pointer: fine)").matches,
      image: css.backgroundImage,
      rest: ["x", "y"].map((a) => css.getPropertyValue(`--r-motion-spotlight-${a}`).trim()),
    };
  }, CARD);
  if (!harness.fine) fail.push("harness: the session's pointer is not fine and hovering");
  if (harness.image !== "none") fail.push(`at rest the card paints ${harness.image}`);
  if (harness.rest.some((v) => v === "" || Number(v) !== 0.5)) fail.push(`at rest the card computes --r-motion-spotlight-x/-y as ${JSON.stringify(harness.rest)}, expected the registered initial value 0.5`);

  const first = await hover(0.25, 0.4);
  const second = await hover(0.75, 0.6);
  for (const [s, fx, fy] of [[first, 25, 40], [second, 75, 60]]) {
    const c = centre(s.image);
    if (s.on !== "on" || !/radial-gradient/.test(s.image)) fail.push(`mouse at ${fx}% × ${fy}%: ${JSON.stringify(s)}`);
    if (Math.abs(s.x * 100 - fx) > 1 || Math.abs(s.y * 100 - fy) > 1) fail.push(`mouse at ${fx}% × ${fy}%: the properties say ${s.x} × ${s.y}`);
    if (!c || Math.abs(c[0] - fx) > 1 || Math.abs(c[1] - fy) > 1) fail.push(`mouse at ${fx}% × ${fy}%: the gradient is centred at ${c}`);
    const [cx, cy] = s.computed.map(Number);
    if (s.computed.includes("") || Math.abs(cx * 100 - fx) > 1 || Math.abs(cy * 100 - fy) > 1) fail.push(`mouse at ${fx}% × ${fy}%: the card computes ${JSON.stringify(s.computed)}`);
    if (s.descendants < 3) fail.push(`harness: the card holds ${s.descendants} element(s), expected its title, description and note`);
    if (s.inherited.length) fail.push(`mouse at ${fx}% × ${fy}%: elements inside the card compute ${JSON.stringify(s.inherited)}, expected 0.5 (the properties inherit)`);
  }
  await page.mouse.move(1, 1);
  const out = await read();
  if (out.on !== null || out.image !== "none") fail.push(`after leaving: ${JSON.stringify(out)}`);

  // Contrast in every theme, lit at the card's middle.
  const themes = await showcaseThemes(page);
  const contrast = [];
  for (const theme of themes) {
    await load({ view: { theme: theme.name } });
    await hover(0.5, 0.5);
    const m = await page.evaluate((sel) => {
      const card = document.querySelector(sel);
      const ctx = Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
      // A colour as the page computes it (a `color-mix()` resolved), which the canvas then paints.
      const probe = document.createElement("div");
      document.body.append(probe);
      const resolve = (c) => {
        probe.style.backgroundColor = c;
        return getComputedStyle(probe).backgroundColor;
      };
      /** Paints the colours in order on one pixel and reads it: any colour space, alpha composited. */
      const paint = (...colours) => {
        ctx.clearRect(0, 0, 1, 1);
        for (const c of colours) {
          ctx.fillStyle = resolve(c);
          ctx.fillRect(0, 0, 1, 1);
        }
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const image = getComputedStyle(card).backgroundImage;
      // The first colour stop: the wash at the pointer, where it is strongest. The
      // gradient's arguments split at top-level commas: shape/size/position (Chrome
      // drops "at 50% 50%", the default), then the stops.
      const args = [];
      const inner = /^radial-gradient\((.*)\)$/.exec(image)?.[1] ?? "";
      let depth = 0;
      let from = 0;
      for (let i = 0; i < inner.length; i++) {
        if (inner[i] === "(") depth++;
        else if (inner[i] === ")") depth--;
        else if (inner[i] === "," && depth === 0) {
          args.push(inner.slice(from, i).trim());
          from = i + 1;
        }
      }
      args.push(inner.slice(from).trim());
      const stop = args.length >= 3 ? /^((?:[a-z-]+\(.*\))|[a-z]+)/.exec(args[1])?.[1] : undefined;
      const canvasBg = getComputedStyle(document.body).backgroundColor;
      const bgColour = getComputedStyle(card).backgroundColor;
      const bg = paint(canvasBg, bgColour);
      const lit = stop ? paint(canvasBg, bgColour, stop) : null;
      const texts = [];
      for (const el of card.querySelectorAll("*")) {
        const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        if (!own) continue;
        // Text on a fill of its own (a button) is that fill's question, not the card's.
        let onCard = true;
        for (let a = el; a && a !== card; a = a.parentElement) {
          if (getComputedStyle(a).backgroundColor !== "rgba(0, 0, 0, 0)") onCard = false;
        }
        if (!onCard) continue;
        const ink = getComputedStyle(el).color;
        const fg = paint(canvasBg, bgColour, ink);
        const fgLit = stop ? paint(canvasBg, bgColour, stop, ink) : null;
        texts.push({ text: el.textContent.trim().slice(0, 24), plain: ratio(fg, bg), lit: lit ? ratio(fgLit, lit) : null });
      }
      probe.remove();
      return { stop, bg, lit, texts };
    }, CARD);
    contrast.push({ theme: theme.name, ...m });
    if (!m.stop) fail.push(`${theme.name}: no colour stop read from the lit card's gradient`);
    if (m.lit && m.lit.every((v, i) => v === m.bg[i])) fail.push(`${theme.name}: the wash changes no pixel (${m.stop} over ${m.bg})`);
    if (m.texts.length < 3) fail.push(`harness: ${theme.name}: ${m.texts.length} text(s) on the card's own fill, expected title, description and note`);
    for (const t of m.texts) {
      if (t.plain >= 4.5 && !(t.lit >= 4.5)) fail.push(`${theme.name}: "${t.text}" ${t.plain.toFixed(2)}:1 drops to ${t.lit?.toFixed(2)}:1 under the wash`);
    }
  }

  await load();
  const touch = await page.evaluate(async (sel) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const card = document.querySelector(sel);
    const r = card.getBoundingClientRect();
    card.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "touch", clientX: r.left + 20, clientY: r.top + 20 }));
    await frame();
    await frame();
    return { on: card.getAttribute("data-spotlight"), image: getComputedStyle(card).backgroundImage };
  }, CARD);
  if (touch.on !== null || touch.image !== "none") fail.push(`a touch move lit the card: ${JSON.stringify(touch)}`);

  await load({ view: { input: "coarse" } });
  const coarseView = await hover(0.5, 0.5);
  if (coarseView.image !== "none") fail.push(`data-input="coarse": the card paints ${coarseView.image}`);

  // A touch device: CDP's media emulation ignores `pointer` and `hover`, so a second,
  // touch-enabled context, where they really are coarse and none. A mouse moved there
  // still sends mouse pointer events, so the script lights the card and only the
  // stylesheet's media gate keeps the wash off.
  const touchContext = await page.context().browser().newContext({ hasTouch: true, viewport: { width: 1280, height: 900 } });
  try {
    const tp = await touchContext.newPage();
    // `openSection` loads on the page's own origin; a new page starts on about:blank.
    await tp.goto(`${base}${SHOWCASE_BLANK}`);
    await openSection(tp, "motion-spotlight");
    await tp.locator(CARD).first().scrollIntoViewIfNeeded();
    const media = await tp.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
    if (media) fail.push("harness: the touch context still reports a fine, hovering pointer");
    const box = await tp.locator(CARD).first().boundingBox();
    await tp.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
    const coarseMedia = await tp.evaluate(async (sel) => {
      const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
      await frame();
      await frame();
      const card = document.querySelector(sel);
      return { on: card.getAttribute("data-spotlight"), image: getComputedStyle(card).backgroundImage };
    }, CARD);
    if (coarseMedia.on !== "on") fail.push(`harness: a mouse over the card in the touch context did not light it (${JSON.stringify(coarseMedia)})`);
    if (coarseMedia.image !== "none") fail.push(`(pointer: coarse) (hover: none): the card paints ${coarseMedia.image}`);
  } finally {
    await touchContext.close();
  }

  await load({ reduced: true });
  const reduced = await hover(0.5, 0.5);
  if (reduced.on !== null || reduced.image !== "none") fail.push(`reduced motion: ${JSON.stringify(reduced)}`);

  await load();
  const lit = await hover(0.5, 0.5);
  await page.emulateMedia({ forcedColors: "active" });
  const forced = await read();
  await page.emulateMedia({ forcedColors: "none", media: "print" });
  const printed = await read();
  await page.emulateMedia({ media: "screen" });
  if (!/radial-gradient/.test(lit.image)) fail.push(`harness: the card was not lit before forcing colours (${lit.image})`);
  if (forced.image !== "none") fail.push(`forced colours: the card paints ${forced.image}`);
  if (printed.image !== "none") fail.push(`print: the card paints ${printed.image}`);

  await load({ width: 375, view: { density: "compact", input: "coarse" } });
  const narrow = await page.evaluate(() => {
    const section = document.getElementById("motion-spotlight");
    return {
      found: Boolean(section),
      page: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      section: section ? section.scrollWidth - section.clientWidth : null,
    };
  });
  if (!narrow.found) fail.push("harness: no #motion-spotlight section at 375");
  if (narrow.page > 0 || narrow.section > 0) fail.push(`375: sideways scroll ${JSON.stringify(narrow)}`);

  stopErrors();
  if (errors.length) fail.push(...errors);
  const worst = contrast.flatMap((c) => c.texts.map((t) => ({ theme: c.theme, ...t }))).sort((a, b) => a.lit - b.lit)[0];
  const result = { first, second, contrast, touch, coarseView, reduced, forced, printed };
  if (fail.length) throw new Error(`motion-extras-spotlight FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `motion-extras-spotlight OK follows the mouse (${first.x.toFixed(2)}×${first.y.toFixed(2)} → ${second.x.toFixed(2)}×${second.y.toFixed(2)}); worst text under the wash ${worst.lit.toFixed(2)}:1 ("${worst.text}", ${worst.theme}) across ${themes.length} themes; nothing on touch, coarse, reduced motion, forced colours or paper`;
}
