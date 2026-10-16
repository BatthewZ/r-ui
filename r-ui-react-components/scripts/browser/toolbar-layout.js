// Browser check: Toolbar layout: overflow into "More", touch spacing and spills.
//
// jsdom lays nothing out (the unit tests feed the overflow plan made-up widths);
// here the toolbar measures itself and the hit areas are real pseudo-elements.
//
// On the Overview's Toolbar section it asserts:
//   1. harness: at 1280 the full-width editor keeps every unit in the bar and
//      More is parked (inert), so the overflow below is caused by width alone;
//   2. the editor in a --COLUMN-MD box: some units moved (data-overflowed, inert),
//      More is in the bar, the moved units are the trailing movable ones (no
//      unit that can move stays in the bar after one that moved) and the Select
//      (no menu form) stays; the bar does not spill (scrollWidth ≤ clientWidth)
//      and More's box ends inside the toolbar's content box;
//   3. opening More lists exactly the moved units' controls, in bar order
//      (each control's name; separators aside), and choosing a moved insert
//      action runs it (the demo's "Last action" output);
//   4. at 375 the full-width editor overflows too (the ResizeObserver re-measures
//      on a viewport change), and widening back to 1280 restores every unit;
//   5. coarse input, comfortable and compact: harness --HIT-MIN 44px and an
//      icon control ICON + 2 × R-SIZE-4 (32 / 26px); the toolbar's gap is the
//      whole overhang, 44 − 32 = 12px / 44 − 26 = 18px; no two neighbouring
//      controls' hit areas (box ∪ ::before, measured from the computed insets)
//      overlap; every icon control's hit area is the full 44px on both axes
//      (the contract's sibling rule is lifted inside a toolbar); a press 1px
//      inside each control's edge reaches that control;
//   6. fine input: the gap falls back to the row's own --R-SIZE-6 (4px);
//   7. at 375 and coarse, no toolbar in the section scrolls sideways or spills.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const load = async ({ input = "fine", density = "comfortable" } = {}) => {
    await page.goto(`${base}#/overview/toolbar-toolbar`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), { theme: "default", density, input });
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-sc="toolbar-editor"]').waitFor();
    await page.waitForTimeout(250);
  };
  /** Each unit of the toolbar: moved or not, its kind, the names of its controls. */
  const units = (sel) =>
    page.evaluate((s) => {
      const bar = document.querySelector(s);
      const name = (el) => el.getAttribute("aria-label") ?? el.textContent.trim();
      const more = bar.querySelector(":scope > [data-toolbar-more]");
      return {
        units: [...bar.querySelectorAll(":scope > [data-toolbar-unit]")].map((u) => ({
          kind: u.dataset.kind,
          moved: u.hasAttribute("data-overflowed"),
          inert: u.inert,
          controls: [...u.querySelectorAll("button, select, input:not([type=hidden])")].map(name),
        })),
        more: more ? { parked: more.hasAttribute("data-overflowed"), inert: more.inert } : null,
        spill: bar.scrollWidth - bar.clientWidth,
      };
    }, sel);

  await page.setViewportSize({ width: 1280, height: 900 });
  await load();

  // ── 1: harness ──────────────────────────────────────────────────────────
  const EDITOR = '[data-sc="toolbar-editor"]';
  const wide = await units(EDITOR);
  if (wide.units.length < 8) fail.push(`harness: the editor has ${wide.units.length} units`);
  if (wide.units.some((u) => u.moved)) fail.push(`harness: at 1280 the full editor moved units: ${JSON.stringify(wide.units.filter((u) => u.moved))}`);
  if (!wide.more?.parked || !wide.more.inert) fail.push(`harness: with everything in the bar More is not parked and inert (${JSON.stringify(wide.more)})`);

  // ── 2: a narrow box ─────────────────────────────────────────────────────
  const NARROW = '[data-sc="toolbar-narrow"]';
  await page.locator(NARROW).scrollIntoViewIfNeeded();
  const narrow = await units(NARROW);
  const movedUnits = narrow.units.filter((u) => u.moved && u.kind !== "separator");
  if (movedUnits.length === 0) fail.push("narrow: no unit moved into More in a --COLUMN-MD box");
  if (narrow.more?.parked || narrow.more?.inert) fail.push("narrow: More is not in the bar");
  if (narrow.units.some((u) => u.moved && !u.inert)) fail.push("narrow: a moved unit is not inert");
  const lastMovable = narrow.units.findLastIndex((u) => u.kind === "item" && !u.moved);
  const firstMoved = narrow.units.findIndex((u) => u.kind === "item" && u.moved);
  if (firstMoved !== -1 && lastMovable > firstMoved) fail.push(`narrow: unit ${lastMovable} stayed in the bar after unit ${firstMoved} moved: units leave from the end`);
  const select = narrow.units.find((u) => u.controls.includes("Font"));
  if (!select || select.moved || select.kind !== "pinned") fail.push(`narrow: the Font select ${JSON.stringify(select)} should be pinned in the bar`);
  if (narrow.spill > 0) fail.push(`narrow: the toolbar spills by ${narrow.spill}px`);
  const moreFits = await page.evaluate((s) => {
    const bar = document.querySelector(s);
    const more = bar.querySelector(":scope > [data-toolbar-more]").getBoundingClientRect();
    const box = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    return more.right <= box.right - Number.parseFloat(cs.borderRightWidth) - Number.parseFloat(cs.paddingRight) + 0.5;
  }, NARROW);
  if (!moreFits) fail.push("narrow: More's box ends past the toolbar's content box");

  // ── 3: the menu lists the moved controls, in order ──────────────────────
  const moreButton = page.locator(NARROW).locator("[data-toolbar-more] button");
  await moreButton.click();
  const menu = page.locator(NARROW).getByRole("menu");
  await menu.waitFor();
  const listed = await menu.evaluate((m) => [...m.querySelectorAll('[role^="menuitem"]')].map((i) => i.textContent.trim()));
  const expectedListed = movedUnits.flatMap((u) => u.controls);
  if (JSON.stringify(listed) !== JSON.stringify(expectedListed)) fail.push(`menu lists ${JSON.stringify(listed)}, expected the moved controls in order ${JSON.stringify(expectedListed)}`);
  const linkName = "Insert link";
  if (expectedListed.includes(linkName)) {
    await menu.getByRole("menuitem", { name: linkName }).click();
    const last = await page.locator('[data-sc="toolbar-last"]').textContent();
    if (!last?.includes(linkName)) fail.push(`choosing "${linkName}" in More did not run it (${last})`);
  } else {
    fail.push(`harness: "${linkName}" did not move into More in the narrow box`);
    await page.keyboard.press("Escape");
  }

  // ── 4: the viewport narrows the full-width editor ───────────────────────
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(250);
  const at375 = await units(EDITOR);
  if (!at375.units.some((u) => u.moved)) fail.push("at 375 the full-width editor moved nothing into More");
  if (at375.spill > 0) fail.push(`at 375 the editor spills by ${at375.spill}px`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(250);
  const restored = await units(EDITOR);
  if (restored.units.some((u) => u.moved)) fail.push("back at 1280 the editor kept units in More");

  // ── 5–6: touch spacing ──────────────────────────────────────────────────
  const spacing = async (sel) =>
    page.evaluate((s) => {
      const bar = document.querySelector(s);
      bar.scrollIntoView({ block: "center" });
      const css = getComputedStyle(bar);
      const px = (el, name) => Number.parseFloat(getComputedStyle(el).getPropertyValue(name));
      const controls = [...bar.querySelectorAll("button, select, input:not([type=hidden])")].filter((el) => !el.closest("[inert]"));
      const hitBox = (el) => {
        const r = el.getBoundingClientRect();
        const before = getComputedStyle(el, "::before");
        const box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        if (before.content === "none" || before.position !== "absolute") return box;
        const st = getComputedStyle(el);
        const inner = {
          left: r.left + Number.parseFloat(st.borderLeftWidth),
          right: r.right - Number.parseFloat(st.borderRightWidth),
          top: r.top + Number.parseFloat(st.borderTopWidth),
          bottom: r.bottom - Number.parseFloat(st.borderBottomWidth),
        };
        const pseudo = {
          left: inner.left + Number.parseFloat(before.left),
          right: inner.right - Number.parseFloat(before.right),
          top: inner.top + Number.parseFloat(before.top),
          bottom: inner.bottom - Number.parseFloat(before.bottom),
        };
        return {
          left: Math.min(box.left, pseudo.left),
          right: Math.max(box.right, pseudo.right),
          top: Math.min(box.top, pseudo.top),
          bottom: Math.max(box.bottom, pseudo.bottom),
        };
      };
      const name = (el) => el.getAttribute("aria-label") ?? el.textContent.trim();
      const boxes = controls.map((el) => ({ name: name(el), icon: el.classList.contains("r-primitives-icon-button"), box: hitBox(el), rect: el.getBoundingClientRect() }));
      const overlaps = [];
      for (let i = 1; i < boxes.length; i += 1) {
        const a = boxes[i - 1].box;
        const b = boxes[i].box;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 0.5 && h > 0.5) overlaps.push(`${boxes[i - 1].name} ∩ ${boxes[i].name}: ${w.toFixed(1)}×${h.toFixed(1)}`);
      }
      const short = boxes
        .filter((b) => b.icon)
        .filter((b) => b.box.right - b.box.left < px(bar, "--HIT-MIN") - 0.5 || b.box.bottom - b.box.top < px(bar, "--HIT-MIN") - 0.5)
        .map((b) => `${b.name} ${(b.box.right - b.box.left).toFixed(1)}×${(b.box.bottom - b.box.top).toFixed(1)}`);
      const stolen = boxes
        .filter((b) => {
          const y = b.rect.top + b.rect.height / 2;
          const hits = [b.rect.left + 1, b.rect.right - 1].map((x) => document.elementFromPoint(x, y)?.closest("button, select, input"));
          return hits.some((hit) => name(hit ?? document.body) !== b.name);
        })
        .map((b) => b.name);
      const icon = boxes.find((b) => b.icon);
      const rootPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const token = (n) => Number.parseFloat(getComputedStyle(bar).getPropertyValue(n)) * (getComputedStyle(bar).getPropertyValue(n).trim().endsWith("rem") ? rootPx : 1);
      return {
        hitMin: token("--HIT-MIN"),
        predictedIcon: token("--ICON") + 2 * token("--R-SIZE-4"),
        iconSize: icon ? [icon.rect.width, icon.rect.height] : null,
        gap: Number.parseFloat(css.columnGap),
        rowGap: token("--R-SIZE-6"),
        count: boxes.length,
        overlaps,
        short,
        stolen,
      };
    }, sel);

  for (const density of ["comfortable", "compact"]) {
    await load({ input: "coarse", density });
    const s = await spacing(EDITOR);
    const tag = `coarse ${density}`;
    if (s.hitMin !== 44) fail.push(`${tag}: harness: --HIT-MIN ${s.hitMin}px, source predicts 44`);
    const predicted = density === "compact" ? 26 : 32;
    if (s.predictedIcon !== predicted || s.iconSize?.[0] !== predicted) fail.push(`${tag}: harness: icon control ${JSON.stringify(s.iconSize)} / tokens ${s.predictedIcon}px, source predicts ${predicted}px`);
    if (Math.abs(s.gap - (44 - predicted)) > 0.5) fail.push(`${tag}: toolbar gap ${s.gap}px, expected the whole overhang ${44 - predicted}px`);
    if (s.count < 10) fail.push(`${tag}: harness: measured ${s.count} controls`);
    if (s.overlaps.length) fail.push(`${tag}: neighbouring hit areas overlap: ${s.overlaps.join("; ")}`);
    if (s.short.length) fail.push(`${tag}: icon controls whose hit area is under 44px: ${s.short.join("; ")}`);
    if (s.stolen.length) fail.push(`${tag}: a press just inside these controls reached another: ${s.stolen.join(", ")}`);
  }

  await load({ input: "fine" });
  const fine = await spacing(EDITOR);
  if (Math.abs(fine.gap - fine.rowGap) > 0.5 || fine.rowGap !== 4) fail.push(`fine: toolbar gap ${fine.gap}px, expected --R-SIZE-6 (4px; read ${fine.rowGap}px)`);

  // ── 7: 375 and coarse, every toolbar ────────────────────────────────────
  await page.setViewportSize({ width: 375, height: 800 });
  await load({ input: "coarse" });
  const spills = await page.evaluate(() =>
    [...document.querySelectorAll('#toolbar-toolbar [role="toolbar"]')].map((bar) => ({
      name: bar.getAttribute("aria-label"),
      spill: bar.scrollWidth - bar.clientWidth,
      past: bar.getBoundingClientRect().right - document.documentElement.clientWidth,
    })),
  );
  if (spills.length < 8) fail.push(`375: harness: found ${spills.length} toolbars in the section`);
  for (const s of spills) if (s.spill > 0 || s.past > 0.5) fail.push(`375 coarse: toolbar "${s.name}" spills (${s.spill}px inside, ${s.past.toFixed(1)}px past the page)`);
  const pageSpill = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (pageSpill > 0) fail.push(`375 coarse: the page scrolls sideways by ${pageSpill}px`);

  const result = { narrow: narrow.units.map((u) => `${u.kind}${u.moved ? "↓" : ""}`).join(" "), listed, at375: at375.units.filter((u) => u.moved).length, fine: fine.gap, spills };
  if (fail.length) throw new Error(`toolbar-layout FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `toolbar-layout OK ${JSON.stringify(result)}`;
}
