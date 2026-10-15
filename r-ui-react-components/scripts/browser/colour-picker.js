// Browser check: ColorPicker with real keys, real layout, the top layer and forced colours.
//
// jsdom paints no canvas, lays nothing out and has no top layer, so the picker's
// geometry, its popup escaping a clipping card, its hit areas and its forced-colour
// edges are settled here. On the Overview's ColorPicker section it asserts:
//   1. harness: the brand demo's trigger reads "#0f766e · Harbour teal" (its
//      default, from source) and is exactly the page's --CONTROL-H (36px);
//   2. keyboard on the area's thumb: ArrowUp ×5 raises lightness by 5 (aria-valuenow),
//      moves the thumb up on screen, and changes the trigger's value and the form's
//      hidden input; Tab to the hue slider, ArrowRight ×10 raises hue by 10, moves the
//      hue thumb toward the inline end and changes the value again;
//   3. typed entry round-trips: "#3366cc" in the hex field comes back as "#3366cc";
//      "oklch(0.6 0.08 200 / 0.5)" in the oklch + alpha field comes back verbatim;
//      chroma 0.12 there (past sRGB) is lowered to the gamut's edge, with the note;
//      "#ff0000" typed there becomes "oklch(0.628 0.257 29.2)";
//   4. an entry it cannot read surfaces a Field error: the text field and the trigger
//      are aria-invalid, the trigger is described by the visible reason, the value is
//      unchanged;
//   5. swatches by keyboard: the checked swatch is the one tab stop; ArrowRight checks
//      and focuses the next ("Ocean blue") and the trigger names it;
//   6. the contrast readout matches an independent WCAG computation of the value
//      against the theme surface, resolved by painting --C-SURFACE-0 on a canvas;
//   7. from the compact card that clips: the popup is a DOM descendant of the card,
//      in the top layer, as wide as 7.5 × the CARD's --CONTROL-H (compact), its swatches
//      the card's size, it reaches past the clip (below, or above when it flips) and a
//      swatch outside it takes the press;
//   8. coarse input: the area and hue thumbs answer a press 20px from their centre and
//      their hit boxes are at least 44px; every swatch is at least 44px;
//   9. forced colours: each thumb keeps a two-system-colour edge (Canvas ring inside a
//      CanvasText one), chips keep their paint, and the checked swatch's edge differs
//      from the others'.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const KEY = "r-ui-showcase:view";
  const SECTION = "form-colorpicker";
  const open = async ({ width = 1280, input = "fine" } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/${SECTION}`);
    await page.evaluate(({ KEY, input }) => localStorage.setItem(KEY, JSON.stringify({ theme: "default", density: "comfortable", input })), { KEY, input });
    await page.reload();
    await waitForShowcase(page);
    await page.locator(`[id="${SECTION}"]`).waitFor();
  };
  const brand = page.locator('[data-sc="color-brand"]');
  const brandTrigger = brand.locator("button[aria-haspopup=dialog]");
  const openBrand = async () => {
    await brandTrigger.scrollIntoViewIfNeeded();
    await brandTrigger.click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Lightness and chroma");
    // Geometry is read after the popup's entry animation, not during it.
    await page.waitForFunction(() =>
      (document.querySelector('[role="dialog"]:popover-open')?.getAnimations({ subtree: true }) ?? []).every((a) => a.playState !== "running"),
    );
  };
  const triggerText = (locator) => locator.evaluate((el) => el.textContent.trim());
  const brandHidden = () => brand.locator('input[type=hidden][name="brand"]').inputValue();
  const thumbState = (name) =>
    page.evaluate((name) => {
      const thumb = [...document.querySelectorAll('[data-sc="color-brand"] [role="slider"]')].find((s) => s.getAttribute("aria-label") === name);
      const r = thumb.getBoundingClientRect();
      return { now: Number(thumb.getAttribute("aria-valuenow")), x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, name);

  // ── 1. harness ────────────────────────────────────────────────────────────
  await open();
  const harness = await brandTrigger.evaluate((el) => ({
    text: el.textContent.trim(),
    h: el.getBoundingClientRect().height,
    token: Number.parseFloat(getComputedStyle(el).getPropertyValue("--CONTROL-H")),
  }));
  if (harness.text !== "#0f766e · Harbour teal" || harness.h !== 36 || harness.token !== 36) fail.push(`harness: brand trigger ${JSON.stringify(harness)}`);

  // ── 2. keyboard on the area and the hue ───────────────────────────────────
  await openBrand();
  const before = { area: await thumbState("Lightness and chroma"), value: await triggerText(brandTrigger) };
  for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowUp");
  const afterArea = { area: await thumbState("Lightness and chroma"), value: await triggerText(brandTrigger), hidden: await brandHidden() };
  if (afterArea.area.now !== before.area.now + 5 || !(afterArea.area.y < before.area.y - 2)) fail.push(`area keys: ${JSON.stringify({ before, afterArea })}`);
  if (afterArea.value === before.value || !afterArea.value.startsWith(afterArea.hidden)) fail.push(`area keys: value ${before.value} → ${afterArea.value} (hidden ${afterArea.hidden})`);
  await page.keyboard.press("Tab");
  const hueBefore = await thumbState("Hue");
  for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowRight");
  const hueAfter = { hue: await thumbState("Hue"), value: await triggerText(brandTrigger) };
  if (hueAfter.hue.now !== hueBefore.now + 10 || !(hueAfter.hue.x > hueBefore.x + 2) || hueAfter.value === afterArea.value) {
    fail.push(`hue keys: ${JSON.stringify({ hueBefore, hueAfter })}`);
  }

  // ── 3. typed entry round-trips ────────────────────────────────────────────
  const brandInput = brand.getByRole("textbox", { name: "Colour value" });
  await brandInput.fill("#3366cc");
  await brandInput.press("Enter");
  const hexBack = { text: await triggerText(brandTrigger), hidden: await brandHidden(), field: await brandInput.inputValue() };
  if (hexBack.hidden !== "#3366cc" || hexBack.field !== "#3366cc" || hexBack.text !== "#3366cc") fail.push(`hex round trip: ${JSON.stringify(hexBack)}`);

  await page.keyboard.press("Escape");
  const tint = page.locator('button[data-sc="color-oklch"]');
  await tint.scrollIntoViewIfNeeded();
  await tint.click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Lightness and chroma");
  const tintInput = page.locator('[role="dialog"]:popover-open').getByRole("textbox", { name: "Colour value" });
  const typedTint = async (text) => {
    await tintInput.fill(text);
    await tintInput.press("Enter");
    return { trigger: await triggerText(tint), field: await tintInput.inputValue() };
  };
  const oklchBack = await typedTint("oklch(0.6 0.08 200 / 0.5)");
  if (oklchBack.trigger !== "oklch(0.6 0.08 200 / 0.5)" || oklchBack.field !== oklchBack.trigger) fail.push(`oklch round trip: ${JSON.stringify(oklchBack)}`);
  // Past the sRGB gamut at this lightness and hue (about 0.10): the chroma is lowered
  // to the edge and the note says so; lightness, hue and alpha are kept.
  const outside = await typedTint("oklch(0.6 0.12 200 / 0.5)");
  const kept = /^oklch\(0\.6 (0\.\d+) 200 \/ 0\.5\)$/.exec(outside.trigger);
  const note = page.locator('[role="dialog"]:popover-open').getByText(/^Outside sRGB: chroma 0\.120 is shown as /);
  if (!kept || !(Number(kept[1]) < 0.12 && Number(kept[1]) > 0.08) || !(await note.isVisible())) {
    fail.push(`oklch outside sRGB: ${JSON.stringify(outside)}, note visible ${await note.isVisible()}`);
  }
  const hexIntoOklch = await typedTint("#ff0000");
  if (hexIntoOklch.trigger !== "oklch(0.628 0.257 29.2)") fail.push(`hex typed into the oklch field: ${JSON.stringify(hexIntoOklch)}`);
  await page.keyboard.press("Escape");
  await openBrand();

  // ── 4. an entry it cannot read ────────────────────────────────────────────
  await brandInput.fill("notacolour");
  await brandInput.press("Enter");
  const refused = await page.evaluate(() => {
    const form = document.querySelector('[data-sc="color-brand"]');
    const trigger = form.querySelector("button[aria-haspopup=dialog]");
    const input = form.querySelector('input[aria-label="Colour value"]');
    const described = (trigger.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id));
    const reason = described.find((el) => el?.textContent.includes("is not a colour"));
    const r = reason?.getBoundingClientRect();
    return {
      input: input.getAttribute("aria-invalid"),
      trigger: trigger.getAttribute("aria-invalid"),
      reason: reason?.textContent,
      visible: Boolean(r && r.width > 0 && r.height > 0 && getComputedStyle(reason).position !== "absolute"),
      hidden: form.querySelector('input[type=hidden][name="brand"]').value,
    };
  });
  if (refused.input !== "true" || refused.trigger !== "true" || !refused.visible || refused.hidden !== "#3366cc") fail.push(`refusal: ${JSON.stringify(refused)}`);
  await brandInput.fill("#3366cc");
  await brandInput.press("Enter");

  // ── 5. swatches by keyboard ───────────────────────────────────────────────
  await brand.getByRole("radio", { name: "Harbour teal" }).click();
  const stops = await brand.evaluate((form) => [...form.querySelectorAll('[role="radio"]')].filter((r) => r.tabIndex === 0).map((r) => r.getAttribute("aria-label")));
  await page.keyboard.press("ArrowRight");
  const swatch = await page.evaluate(() => ({
    focused: document.activeElement?.getAttribute("aria-label"),
    checked: [...document.querySelectorAll('[data-sc="color-brand"] [role="radio"][aria-checked="true"]')].map((r) => r.getAttribute("aria-label")),
    trigger: document.querySelector('[data-sc="color-brand"] button[aria-haspopup=dialog]').textContent.trim(),
  }));
  if (stops.join() !== "Harbour teal" || swatch.focused !== "Ocean blue" || swatch.checked.join() !== "Ocean blue" || swatch.trigger !== "#1d4ed8 · Ocean blue") {
    fail.push(`swatches: ${JSON.stringify({ stops, swatch })}`);
  }

  // ── 6. contrast against the theme surface ─────────────────────────────────
  const contrast = await page.evaluate(() => {
    const form = document.querySelector('[data-sc="color-brand"]');
    // The surface as the browser paints it, read back as 8-bit sRGB.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = getComputedStyle(form).getPropertyValue("--C-SURFACE-0");
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const hex = form.querySelector('input[type=hidden][name="brand"]').value;
    const fg = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
    const lum = (rgb) =>
      rgb.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [hi, lo] = [lum(fg), lum([r, g, b])].sort((x, y) => y - x);
    const readout = form.querySelector("[data-ratio]");
    return {
      expected: (hi + 0.05) / (lo + 0.05),
      shown: Number(readout?.dataset.ratio),
      text: form.querySelector("[data-contrast]")?.textContent,
    };
  });
  const aa = contrast.expected >= 4.5 ? "AA passes" : "AA fails";
  if (!(Math.abs(contrast.expected - contrast.shown) < 0.03) || !contrast.text.includes(aa)) fail.push(`contrast: ${JSON.stringify(contrast)}`);
  await page.keyboard.press("Escape");

  // ── 7. popup from a compact card that clips ───────────────────────────────
  const card = page.locator('[data-sc="color-clip"]');
  await card.scrollIntoViewIfNeeded();
  await card.locator("button[aria-haspopup=dialog]").click();
  await page.waitForTimeout(300);
  const popup = await page.evaluate(() => {
    const card = document.querySelector('[data-sc="color-clip"]');
    const panel = card.querySelector('[role="dialog"]');
    if (!panel) return { panel: false };
    const clip = card.getBoundingClientRect();
    const swatches = [...panel.querySelectorAll('[role="radio"]')];
    // The popup opens below the card or flips above it; probe a swatch outside the clip.
    const outside = swatches.find((s) => {
      const r = s.getBoundingClientRect();
      return r.top > clip.bottom + 2 || r.bottom < clip.top - 2;
    });
    const or = outside?.getBoundingClientRect();
    const hit = or && document.elementFromPoint(or.left + or.width / 2, or.top + or.height / 2);
    const control = Number.parseFloat(getComputedStyle(card).getPropertyValue("--CONTROL-H"));
    return {
      panel: true,
      inCard: card.contains(panel),
      topLayer: panel.matches(":popover-open"),
      overflow: getComputedStyle(card).overflow,
      control,
      page: Number.parseFloat(getComputedStyle(document.body).getPropertyValue("--CONTROL-H")),
      width: panel.getBoundingClientRect().width,
      swatch: swatches[0]?.getBoundingClientRect().width,
      reachesPast: panel.getBoundingClientRect().bottom > clip.bottom + 40 || panel.getBoundingClientRect().top < clip.top - 40,
      hitOutside: Boolean(hit && outside && outside.contains(hit)),
    };
  });
  if (!popup.panel) fail.push("clip: no dialog inside the compact card");
  else {
    if (!popup.inCard || !popup.topLayer || popup.overflow !== "hidden") fail.push(`clip: in card ${popup.inCard}, top layer ${popup.topLayer}, card overflow ${popup.overflow}`);
    if (popup.control !== 28 || popup.page !== 36 || Math.abs(popup.width - 28 * 7.5) > 0.5 || Math.abs(popup.swatch - 24.5) > 0.5) {
      fail.push(`clip: popup ${popup.width}px, swatch ${popup.swatch}px for card --CONTROL-H ${popup.control} in a ${popup.page} page (expected 210 / 24.5)`);
    }
    if (!popup.reachesPast || !popup.hitOutside) fail.push(`clip: reaches past ${popup.reachesPast}, a swatch outside the card takes the press ${popup.hitOutside}`);
  }
  await page.keyboard.press("Escape");

  // ── 8. coarse hit areas ───────────────────────────────────────────────────
  await open({ input: "coarse" });
  await openBrand();
  const coarse = await page.evaluate(() => {
    const form = document.querySelector('[data-sc="color-brand"]');
    const thumbs = [...form.querySelectorAll('[role="slider"]')].map((thumb) => {
      const r = thumb.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const before = getComputedStyle(thumb.querySelector(".hit-area"), "::before");
      const answers = [
        [cx + 20, cy],
        [cx - 20, cy],
        [cx, cy + 20],
        [cx, cy - 20],
      ].every(([x, y]) => document.elementFromPoint(x, y)?.closest('[role="slider"]') === thumb);
      return { name: thumb.getAttribute("aria-label"), hitW: Number.parseFloat(before.width), hitH: Number.parseFloat(before.height), answers };
    });
    const swatches = [...form.querySelectorAll('[role="radio"]')].map((s) => Math.min(s.getBoundingClientRect().width, s.getBoundingClientRect().height));
    return { thumbs, swatches: swatches.length, smallestSwatch: Math.min(...swatches) };
  });
  for (const t of coarse.thumbs) if (t.hitW < 44 || t.hitH < 44 || !t.answers) fail.push(`coarse: ${JSON.stringify(t)}`);
  // Math.min of no swatches is Infinity: the count comes first.
  if (coarse.thumbs.length !== 2 || coarse.swatches < 2 || coarse.smallestSwatch < 44) {
    fail.push(`coarse: ${coarse.thumbs.length} thumbs, ${coarse.swatches} swatches, the smallest ${coarse.smallestSwatch}px`);
  }
  await page.keyboard.press("Escape");

  // ── 9. forced colours ─────────────────────────────────────────────────────
  await open();
  await page.emulateMedia({ forcedColors: "active" });
  await openBrand();
  const forced = await page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const sys = (c) => {
      probe.style.color = c;
      return getComputedStyle(probe).color;
    };
    const [canvas, canvasText, highlight] = [sys("Canvas"), sys("CanvasText"), sys("Highlight")];
    probe.remove();
    const form = document.querySelector('[data-sc="color-brand"]');
    const thumbs = [...form.querySelectorAll('[role="slider"]')].map((t) => {
      const s = getComputedStyle(t);
      return { border: s.borderTopColor, width: Number.parseFloat(s.borderTopWidth), shadow: s.boxShadow };
    });
    const chip = getComputedStyle(form.querySelector(".r-form-color-chip")).backgroundImage;
    const swatchEdges = [...form.querySelectorAll('[role="radio"]')].map((r) => [r.getAttribute("aria-checked"), getComputedStyle(r).borderTopColor]);
    return { canvas, canvasText, highlight, thumbs, chip, swatchEdges };
  });
  if (forced.thumbs.length !== 2 || forced.swatchEdges.length < 2) {
    fail.push(`forced colours: measured ${forced.thumbs.length} thumbs and ${forced.swatchEdges.length} swatches, expected 2 and several`);
  }
  for (const t of forced.thumbs) {
    if (t.border !== forced.canvas || t.width < 2 || !t.shadow.includes(forced.canvasText)) fail.push(`forced colours: thumb edge ${JSON.stringify(t)} (Canvas ${forced.canvas}, CanvasText ${forced.canvasText})`);
  }
  if (!forced.chip.includes("gradient")) fail.push(`forced colours: the chip lost its paint (${forced.chip})`);
  const checkedEdge = forced.swatchEdges.filter(([c]) => c === "true").map(([, e]) => e);
  const otherEdges = new Set(forced.swatchEdges.filter(([c]) => c !== "true").map(([, e]) => e));
  if (checkedEdge.length !== 1 || checkedEdge[0] !== forced.highlight || otherEdges.has(checkedEdge[0])) fail.push(`forced colours: swatch edges ${JSON.stringify(forced.swatchEdges)}`);
  await page.keyboard.press("Escape");
  await page.emulateMedia({ forcedColors: "none" });

  await page.evaluate((KEY) => localStorage.removeItem(KEY), KEY);
  if (fail.length) throw new Error(`colour-picker:\n  ${fail.join("\n  ")}`);
  return `colour-picker: area/hue keys, hex+oklch round trips, refusal, swatch radios, contrast ${contrast.shown.toFixed(2)}:1 (independent ${contrast.expected.toFixed(2)}), compact popup ${popup.width}px past the clip, coarse hit areas, forced-colour edges`;
};
