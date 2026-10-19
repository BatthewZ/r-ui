// @covers   toolbar/Toolbar
// @sections toolbar-toolbar
// @tier     component
//
// Browser check: Toolbar layout: overflow into "More", touch spacing and spills,
// with a real-key smoke of its one tab stop and its drawn order right to left.
//
// Run it through `bun run browser:check toolbar`.
//
// jsdom lays nothing out (the unit tests feed the overflow plan made-up widths);
// here the toolbar measures itself and the hit areas are real pseudo-elements.
// The keyboard model (stops, arrows, radios, disabled controls, a text input's
// caret, ToggleGroup) is Toolbar.test.tsx's, ToggleGroup.test.tsx's and
// use-roving-focus.test.tsx's.
//
// On the Toolbar section, opened alone, it asserts:
//   1. harness: at 1280 the full-width editor keeps every unit in the bar and
//      More is parked (inert), so the overflow below is caused by width alone;
//      real Tab: from the control before the editor, Tab lands on its one stop (the
//      first control) and the next Tab leaves the toolbar; in the RTL editor (a
//      `dir="rtl"` ancestor) every control is drawn LEFT of the one before it, across
//      groups and units, ArrowLeft moves from the first to the second and ArrowRight back;
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
//      inside each control's inline edges reaches that control;
//   6. fine input: the gap falls back to the row's own --R-SIZE-6 (4px);
//   7. at 375 and coarse, no toolbar in the section scrolls sideways or spills;
//   8. squeezed: the narrow editor in a flex row beside a sibling that grows and
//      shrinks with no floor of its own (a title) keeps what cannot leave it: its
//      pinned Select and More (ICON + 2 × R-SIZE-4) drawn whole inside it, no spill;
//      the harness first proves the sibling would take everything (it is wider
//      than the row) and that something did move into More.
async (page) => {
  const fail = [];
  const load = async ({ input = "fine", density = "comfortable", width, height } = {}) => {
    await openSection(page, "toolbar-toolbar", { width, height, view: { theme: "default", density, input } });
    await page.locator('[data-sc="toolbar-editor"]').waitFor();
    await overflowSettled();
  };
  /**
   * Waits until every toolbar's overflow (which units are in More, each bar's width)
   * has held for three frames: a toolbar re-measures from a ResizeObserver, a frame
   * or two after its box changes. Throws after 3 s of change.
   */
  const overflowSettled = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const read = () =>
            [...document.querySelectorAll("[data-toolbar-unit], [data-toolbar-more]")]
              .map((u) => `${u.hasAttribute("data-overflowed")}${u.parentElement.getBoundingClientRect().width}`)
              .join();
          const until = performance.now() + 3000;
          let last = read();
          let held = 0;
          const tick = () => {
            const now = read();
            held = now === last ? held + 1 : 0;
            last = now;
            if (held >= 3) resolve();
            else if (performance.now() > until) reject(new Error("harness: the toolbars' overflow kept changing for 3s"));
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
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

  await load();

  // ── 1: harness ──────────────────────────────────────────────────────────
  const EDITOR = '[data-sc="toolbar-editor"]';
  const wide = await units(EDITOR);
  if (wide.units.length < 8) fail.push(`harness: the editor has ${wide.units.length} units`);
  if (wide.units.some((u) => u.moved)) fail.push(`harness: at 1280 the full editor moved units: ${JSON.stringify(wide.units.filter((u) => u.moved))}`);
  if (!wide.more?.parked || !wide.more.inert) fail.push(`harness: with everything in the bar More is not parked and inert (${JSON.stringify(wide.more)})`);

  /** The focused control's name, and whether it sits inside `sel`. */
  const focused = (sel) =>
    page.evaluate((s) => {
      const el = document.activeElement;
      return { name: el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? null, inside: Boolean(el && document.querySelector(s)?.contains(el)) };
    }, sel);
  const firstControl = wide.units.flatMap((u) => u.controls)[0];
  await page.locator(EDITOR).scrollIntoViewIfNeeded();
  await page.evaluate((s) => {
    const bar = document.querySelector(s);
    const before = [...document.querySelectorAll("a[href], button:not(:disabled), input, select, [tabindex]:not([tabindex='-1'])")].filter(
      (el) => !bar.contains(el) && el.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING && el.checkVisibility(),
    );
    before.at(-1)?.focus();
  }, EDITOR);
  await page.keyboard.press("Tab");
  const entered = await focused(EDITOR);
  if (!firstControl || !entered.inside || entered.name !== firstControl) fail.push(`Tab into the toolbar landed on ${JSON.stringify(entered)}, expected "${firstControl}"`);
  await page.keyboard.press("Tab");
  const tabbedOut = await focused(EDITOR);
  if (tabbedOut.inside) fail.push(`a second Tab stayed in the toolbar (on "${tabbedOut.name}"): more than one tab stop`);

  const RTL = '[data-sc="toolbar-rtl"]';
  await page.locator(RTL).scrollIntoViewIfNeeded();
  const rtl = await page.evaluate((s) => {
    const items = [...document.querySelector(s).querySelectorAll("button, select")].filter((el) => !el.closest("[inert]"));
    const boxes = items.map((el) => el.getBoundingClientRect());
    const [a, b] = boxes;
    const outOfOrder = items.filter((el, i) => i > 0 && !(boxes[i].right <= boxes[i - 1].left + 1)).map((el) => el.getAttribute("aria-label") ?? el.tagName);
    return { names: items.slice(0, 2).map((el) => el.getAttribute("aria-label")), count: items.length, secondIsLeft: Boolean(a && b && b.right <= a.left + 1), outOfOrder };
  }, RTL);
  if (rtl.names.length !== 2 || rtl.names.some((n) => !n)) fail.push(`RTL harness: the first two controls are named ${JSON.stringify(rtl.names)}`);
  if (!rtl.secondIsLeft) fail.push("RTL: the second control is not drawn to the left of the first");
  if (rtl.count < 4 || rtl.outOfOrder.length) fail.push(`RTL: of ${rtl.count} controls, ${JSON.stringify(rtl.outOfOrder)} are not drawn left of the control before them`);
  await page.locator(RTL).getByRole("button", { name: rtl.names[0] }).focus();
  await page.keyboard.press("ArrowLeft");
  const rtlNext = await focused(RTL);
  if (rtlNext.name !== rtl.names[1]) fail.push(`RTL: ArrowLeft landed on "${rtlNext.name}", expected "${rtl.names[1]}" (drawn to its left)`);
  await page.keyboard.press("ArrowRight");
  const rtlBack = await focused(RTL);
  if (rtlBack.name !== rtl.names[0]) fail.push(`RTL: ArrowRight landed on "${rtlBack.name}", expected "${rtl.names[0]}"`);

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
  await overflowSettled();
  const at375 = await units(EDITOR);
  if (!at375.units.some((u) => u.moved)) fail.push("at 375 the full-width editor moved nothing into More");
  if (at375.spill > 0) fail.push(`at 375 the editor spills by ${at375.spill}px`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await overflowSettled();
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
  await load({ input: "coarse", width: 375, height: 800 });
  const spills = await page.evaluate(() =>
    [...document.querySelectorAll('#toolbar-toolbar [role="toolbar"]')].map((bar) => ({
      name: bar.getAttribute("aria-label"),
      spill: bar.scrollWidth - bar.clientWidth,
      past: bar.getBoundingClientRect().right - document.documentElement.clientWidth,
    })),
  );
  if (spills.length < 8) fail.push(`375: harness: found ${spills.length} toolbars in the section`);
  for (const s of spills) if (s.spill > 0 || s.past > 0.5) fail.push(`375 coarse: toolbar "${s.name}" spills (${s.spill}px inside, ${s.past.toFixed(1)}px past the page)`);

  // ── 8: squeezed beside a growing sibling ────────────────────────────────
  await load();
  await page.evaluate((sel) => {
    const bar = document.querySelector(sel);
    const row = document.createElement("div");
    row.dataset.squeeze = "";
    row.style.cssText = "display:flex;inline-size:var(--COLUMN-MD)";
    const title = document.createElement("div");
    title.style.cssText = "flex:1 1 auto;min-inline-size:0;white-space:nowrap;overflow:hidden";
    title.textContent = "A title long enough to take the whole row and then some more of it";
    bar.before(row);
    row.append(title, bar);
  }, NARROW);
  await overflowSettled();
  const squeezed = await page.evaluate((sel) => {
    const bar = document.querySelector(sel);
    const row = bar.parentElement;
    const title = row.firstElementChild;
    const probe = document.createElement("div");
    probe.style.inlineSize = "calc(var(--ICON) + 2 * var(--R-SIZE-4))";
    row.after(probe);
    const floor = probe.getBoundingClientRect().width;
    probe.remove();
    const more = bar.querySelector(":scope > [data-toolbar-more] button").getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    const pinned = [...bar.querySelectorAll(':scope > [data-kind="pinned"]')].map((u) => u.getBoundingClientRect());
    return {
      floor,
      width: b.width,
      titleWants: title.scrollWidth,
      row: row.getBoundingClientRect().width,
      more: [more.left - b.left, b.right - more.right, more.width],
      pinnedOut: pinned.filter((u) => u.left < b.left - 0.5 || u.right > b.right + 0.5).length,
      pinned: pinned.length,
      spill: bar.scrollWidth - bar.clientWidth,
    };
  }, NARROW);
  const afterSqueeze = await units(NARROW);
  if (!afterSqueeze.units.some((u) => u.moved) || afterSqueeze.more?.parked) fail.push("squeezed: harness: nothing moved into More, so the floor was never needed");
  if (!(squeezed.titleWants > squeezed.row)) fail.push(`squeezed: harness: the title (${squeezed.titleWants}px) does not want more than the row (${squeezed.row}px)`);
  if (squeezed.width < squeezed.floor - 0.5) fail.push(`squeezed: the toolbar is ${squeezed.width}px, under its More button's ${squeezed.floor}px`);
  if (squeezed.pinned === 0) fail.push("squeezed: harness: the narrow editor has no pinned unit");
  if (squeezed.pinnedOut > 0 || squeezed.spill > 0) fail.push(`squeezed: ${squeezed.pinnedOut} pinned unit(s) drawn past the toolbar, spill ${squeezed.spill}px`);
  if (squeezed.more[0] < -0.5 || squeezed.more[1] < -0.5 || Math.abs(squeezed.more[2] - squeezed.floor) > 0.5) {
    fail.push(`squeezed: More is not drawn whole inside the toolbar (${squeezed.more.map((v) => v.toFixed(1))})`);
  }

  const result = {
    narrow: narrow.units.map((u) => `${u.kind}${u.moved ? "↓" : ""}`).join(" "),
    listed,
    at375: at375.units.filter((u) => u.moved).length,
    fine: fine.gap,
    squeezed: squeezed.width,
    spills,
    entered: entered.name,
    rtl: rtl.names,
  };
  if (fail.length) throw new Error(`toolbar FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `toolbar OK ${JSON.stringify(result)}`;
}
