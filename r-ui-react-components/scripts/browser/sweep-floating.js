// @covers   overlays, form/Combobox, form/MultiSelect, form/TagInput, form/ColorPicker,
//           dates/DatePicker, dates/DateRangePicker, dates/TimePicker, marketing/NavigationMenu,
//           commands/CommandPalette
// @sections overlays-popover dates-daterangepicker
// @tier     sweep
// @cost     20
//
// Browser check: anchored panels. Every floating component opened from a compact card that
// clips is in place, in the top layer, past the clip and at the card's density; a panel hides
// while its trigger is scrolled out of view; at 375 a panel keeps its own margin from the edges.
//
// jsdom has no layout, so the hooks' tests can only fake the geometry; this is the real thing.
//
// Asserts:
//   1. the floating sweep, on the Stress page's floating panel (`#stress-floating`), at
//      comfortable fine and again (switched live) at coarse: each case is opened as a user
//      opens it, from a `data-density="compact"` card with `overflow: hidden` (the menu,
//      popover and tooltip from `stress-clip-card`; the others from their own
//      `[data-floating-case]` card), and its panel
//        - is a DOM descendant of the card (in place, never portalled),
//        - is in the top layer (`:popover-open`, or `:modal` for the command palette),
//        - reaches past the card's clip box, and a point of it outside that box takes the
//          press (elementFromPoint; not for the tooltip, which takes none),
//        - resolves the card's density: its --ROW-H, --CONTROL-H and --R-SIZE-3 are the card's
//          (a portalled panel would read the page's), and what it draws follows: rows (menu
//          items, options, navigation links) exactly the card's --ROW-H, day cells and field
//          frames exactly the card's --CONTROL-H, the tooltip's inline padding the card's
//          --R-SIZE-5, the hover card's padding its --R-SIZE-3, the colour picker 7.5 × the
//          card's --CONTROL-H wide with swatches max(--HIT-MIN, --ICON × 1.75);
//      harness: the card's --ROW-H is below the page's at fine (compact holds), every case
//      opens a panel, and at least the expected rows are measured;
//   2. an open Popover (placement top, with an arrow) is visible and sits 8px above its
//      trigger; with the page scrolled until the trigger is above the viewport it carries
//      `data-reference-hidden` and computes `visibility: hidden`, still open (mounted, so
//      state and focus bookkeeping survive); scrolled back it is visible and re-anchored;
//   3. at 375, the DateRangePicker's two-month popup (wider than the viewport by design) and
//      a Dashboard row's actions menu (its trigger at the inline end) each sit at least the
//      panel's own --R-SIZE-2 inside `clientWidth` on both sides, and the promoted panel's cap
//      resolves against `100%` (the viewport without its scrollbar), never a `vw` length.
//      Headless Chromium hides scrollbars, so the computed cap is what tells them apart.
async (page) => {
  const fail = [];
  const { errors, stop: stopErrors } = collectErrors(page);
  const CLIP = '[data-testid="stress-clip-card"]';
  const caseCard = (name) => `[data-floating-case="${name}"]`;

  /** Each case: its card, how a user opens it, its panel, and what in it follows the card's density. */
  const CASES = [
    { name: "menu", card: CLIP, open: (c) => c.getByRole("button", { name: "Row actions" }).click(), panel: '[role="menu"]', rows: '[role^="menuitem"]', min: 8 },
    { name: "popover", card: CLIP, open: (c) => c.getByRole("button", { name: "Filters" }).click(), panel: '[role="dialog"][aria-label="Compact filters"]', frames: ".r-form-frame", min: 2 },
    { name: "tooltip", card: CLIP, open: (c) => c.getByRole("button", { name: "Hover or focus me" }).focus(), panel: '[role="tooltip"]', press: false, padding: ["paddingInlineStart", "--R-SIZE-5"] },
    {
      name: "contextmenu",
      card: caseCard("contextmenu"),
      open: async (c) => {
        await c.getByLabel("Canvas: Shift+F10 for its actions").focus();
        await page.keyboard.press("Shift+F10");
      },
      panel: '[role="menu"]',
      rows: '[role^="menuitem"]',
      min: 5,
    },
    { name: "hovercard", card: caseCard("hovercard"), open: (c) => c.getByRole("link", { name: "@grace" }).focus(), panel: '[role="group"]', padding: ["paddingTop", "--R-SIZE-3"] },
    { name: "navigationmenu", card: caseCard("navigationmenu"), open: (c) => c.getByRole("button", { name: "Resources" }).click(), panel: "[data-nav-panel]", rows: "a[href]", min: 3 },
    { name: "combobox", card: caseCard("combobox"), open: (c) => c.getByRole("combobox", { name: "Region" }).click(), panel: '[role="listbox"]', rows: '[role="option"]', min: 5 },
    { name: "multiselect", card: caseCard("multiselect"), open: (c) => c.getByRole("combobox", { name: "Regions" }).click(), panel: '[role="listbox"]', rows: '[role="option"]', min: 5 },
    {
      name: "taginput",
      card: caseCard("taginput"),
      open: async (c) => {
        await c.getByRole("combobox", { name: "Labels" }).focus();
        await page.keyboard.press("ArrowDown");
      },
      panel: '[role="listbox"]',
      rows: '[role="option"]',
      min: 5,
    },
    { name: "colorpicker", card: caseCard("colorpicker"), open: (c) => c.locator("button[aria-haspopup=dialog]").click(), panel: '[role="dialog"]', colour: true },
    { name: "datepicker", card: caseCard("datepicker"), open: (c) => c.getByRole("button", { name: "Choose date" }).click(), panel: '[role="dialog"]', cells: "[data-date]", min: 28 },
    { name: "daterangepicker", card: caseCard("daterangepicker"), open: (c) => c.getByRole("button", { name: /Time range/ }).click(), panel: ".r-dates-range-panel", cells: "[data-date]", min: 28 },
    { name: "timepicker", card: caseCard("timepicker"), open: (c) => c.getByRole("button", { name: "Choose time" }).click(), panel: '[role="dialog"]', rows: '[role="option"]', min: 8 },
    { name: "commandpalette", card: caseCard("commandpalette"), open: (c) => c.getByRole("button", { name: "Open the palette" }).click(), panel: "dialog", rows: '[role="option"]', min: 6 },
  ];

  /**
   * The case's open panel, in the page: drawn and inside its card, else drawn in the top layer
   * anywhere (a portalled one, which the in-place assertion then names).
   */
  const FIND = `(card, panel) => {
    const c = document.querySelector(card);
    const drawn = [...document.querySelectorAll(panel)].filter((el) => el.getClientRects().length > 0 && el.checkVisibility());
    return drawn.find((el) => c.contains(el)) ?? drawn.find((el) => el.closest(":popover-open, :modal")) ?? null;
  }`;

  /** The open panel against its card, measured in the page. */
  const measure = ({ card, panel, rows, cells, frames, padding, colour = false }) =>
    page.evaluate(
      ({ card, panel, rows, cells, frames, padding, colour, FIND }) => {
        const c = document.querySelector(card);
        const p = (0, eval)(FIND)(card, panel);
        if (!p) return null;
        const probe = (host, prop, value) => {
          const s = document.createElement("div");
          s.style.cssText = `position:absolute;visibility:hidden;${prop}:${value}`;
          host.append(s);
          const r = s.getBoundingClientRect();
          s.remove();
          return prop === "block-size" ? r.height : r.width;
        };
        const cr = c.getBoundingClientRect();
        const pr = p.getBoundingClientRect();
        // A point inside the panel but outside the card's clip box, if there is one.
        const y = pr.bottom > cr.bottom + 4 ? (Math.max(pr.top, cr.bottom) + pr.bottom) / 2 : pr.top < cr.top - 4 ? (pr.top + Math.min(pr.bottom, cr.top)) / 2 : null;
        const x = (Math.max(pr.left, 0) + Math.min(pr.right, innerWidth)) / 2;
        const hit = y === null ? null : document.elementFromPoint(x, y);
        const tokens = (el) => Object.fromEntries(["--ROW-H", "--CONTROL-H", "--R-SIZE-3"].map((t) => [t, getComputedStyle(el).getPropertyValue(t).trim()]));
        const heights = (sel) => (sel ? [...p.querySelectorAll(sel)].filter((el) => el.getClientRects().length > 0).map((el) => el.getBoundingClientRect().height) : []);
        const swatches = colour ? [...p.querySelectorAll('[role="radio"]')].map((el) => el.getBoundingClientRect().width) : [];
        return {
          inCard: c.contains(p),
          overflow: getComputedStyle(c).overflow,
          topLayer: !!p.closest(":popover-open, :modal"),
          beyond: Math.max(cr.top - pr.top, pr.bottom - cr.bottom, cr.left - pr.left, pr.right - cr.right),
          hit: y === null ? "no part of the panel lies outside the card" : p.contains(hit) ? "panel" : hit ? `${hit.tagName.toLowerCase()} "${hit.textContent.trim().slice(0, 20)}"` : "nothing",
          card: tokens(c),
          panel: tokens(p),
          pageRowH: getComputedStyle(document.documentElement).getPropertyValue("--ROW-H").trim(),
          rowH: probe(c, "block-size", "var(--ROW-H)"),
          controlH: probe(c, "block-size", "var(--CONTROL-H)"),
          rows: heights(rows),
          cells: heights(cells),
          frames: heights(frames),
          padding: padding ? { drawn: Number.parseFloat(getComputedStyle(p)[padding[0]]), token: probe(c, "inline-size", `var(${padding[1]})`) } : null,
          colour: colour ? { width: pr.width, want: probe(c, "inline-size", "calc(var(--CONTROL-H) * 7.5)"), swatches, swatch: probe(c, "inline-size", "max(var(--HIT-MIN), calc(var(--ICON) * 1.75))") } : null,
        };
      },
      { card, panel, rows, cells, frames, padding, colour, FIND },
    );

  const near = (a, b) => Math.abs(a - b) <= 0.5;
  let opened = 0;
  let rowsMeasured = 0;
  try {
    // ── 1. the floating sweep ────────────────────────────────────────────────
    await openPage(page, "stress", { view: { theme: "default", density: "comfortable", input: "fine" } });
    for (const input of ["fine", "coarse"]) {
      if (input === "coarse") await setView(page, { input });
      for (const kase of CASES) {
        const label = `${input} ${kase.name}`;
        const card = page.locator(kase.card);
        await card.scrollIntoViewIfNeeded();
        await page.evaluate((sel) => window.scrollBy(0, document.querySelector(sel).getBoundingClientRect().top - 120), kase.card);
        await kase.open(card);
        // Entry animations finish before geometry is read.
        const where = { card: kase.card, panel: kase.panel, FIND };
        await page.waitForFunction(({ card, panel, FIND }) => (0, eval)(FIND)(card, panel) !== null, where, { timeout: 3000 }).catch(() => undefined);
        await settle(page);
        const m = await measure(kase);
        if (!m) {
          fail.push(`${label}: no panel open in its card`);
        } else {
          opened++;
          if (m.overflow !== "hidden") fail.push(`${label}: harness: the card's overflow is ${m.overflow}, expected hidden`);
          if (!m.inCard) fail.push(`${label}: the panel is not a DOM descendant of its card (portalled?)`);
          if (!m.topLayer) fail.push(`${label}: the panel is not in the top layer`);
          if (!(m.beyond > 1)) fail.push(`${label}: the panel does not reach past the card's clip box (${m.beyond}px)`);
          if (kase.press !== false && m.hit !== "panel") fail.push(`${label}: a press on the panel outside the card reached ${m.hit}`);
          for (const t of Object.keys(m.card)) if (m.panel[t] !== m.card[t]) fail.push(`${label}: the panel resolves ${t} ${m.panel[t]}, its card ${m.card[t]}`);
          if (input === "fine" && !(Number.parseFloat(m.card["--ROW-H"]) < Number.parseFloat(m.pageRowH))) fail.push(`${label}: harness: the card's --ROW-H ${m.card["--ROW-H"]} is not below the page's ${m.pageRowH}`);
          for (const [what, list, want] of [
            ["rows", m.rows, m.rowH],
            ["day cells", m.cells, m.controlH],
            ["field frames", m.frames, m.controlH],
          ]) {
            const asked = { rows: kase.rows, "day cells": kase.cells, "field frames": kase.frames }[what];
            if (!asked) continue;
            if (list.length < (kase.min ?? 1)) fail.push(`${label}: harness: ${list.length} ${what} measured`);
            if (list.some((h) => !near(h, want))) fail.push(`${label}: ${what} are ${[...new Set(list)].join(", ")}px, the card's ${what === "rows" ? "--ROW-H" : "--CONTROL-H"} is ${want}px`);
            rowsMeasured += list.length;
          }
          if (m.padding && !near(m.padding.drawn, m.padding.token)) fail.push(`${label}: the panel's padding is ${m.padding.drawn}px, the card's ${kase.padding[1]} ${m.padding.token}px`);
          if (m.colour) {
            if (!near(m.colour.width, m.colour.want)) fail.push(`${label}: the picker is ${m.colour.width}px wide, 7.5 × the card's --CONTROL-H is ${m.colour.want}px`);
            if (m.colour.swatches.length < 6 || m.colour.swatches.some((w) => !near(w, m.colour.swatch))) fail.push(`${label}: swatches ${[...new Set(m.colour.swatches)].join(", ")}px, expected ${m.colour.swatch}px`);
          }
        }
        await page.keyboard.press("Escape");
        if (kase.name === "tooltip" || kase.name === "hovercard") await page.evaluate(() => document.activeElement?.blur());
        await page.waitForFunction(({ card, panel, FIND }) => (0, eval)(FIND)(card, panel) === null, where, { timeout: 3000 }).catch(() => fail.push(`${label}: Escape left the panel open`));
        await settle(page);
      }
    }
    if (opened !== CASES.length * 2) fail.push(`harness: ${opened} of ${CASES.length * 2} panels measured`);

    // ── 2. hidden while the trigger is scrolled away ─────────────────────────
    const section = await openSection(page, "overlays-popover", { runway: true });
    const trigger = section.getByRole("button", { name: "With arrow" });
    await trigger.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -200));
    await trigger.click();
    await page.getByRole("dialog", { name: "About" }).waitFor();
    await settle(page);
    const read = () =>
      page.evaluate(() => {
        const t = [...document.querySelectorAll("#overlays-popover button")].find((b) => b.textContent.trim() === "With arrow");
        const p = document.querySelector('[role="dialog"][aria-label="About"]');
        if (!t || !p) return { mounted: Boolean(p) };
        const tr = t.getBoundingClientRect();
        const pr = p.getBoundingClientRect();
        return {
          mounted: true,
          visibility: getComputedStyle(p).visibility,
          flagged: p.hasAttribute("data-reference-hidden"),
          triggerTop: tr.top,
          triggerBottom: tr.bottom,
          gap: tr.top - pr.bottom,
        };
      });
    const open = await read();
    if (open.visibility !== "visible" || open.flagged) fail.push(`harness: open panel is not visible (${JSON.stringify(open)})`);
    if (Math.abs(open.gap - 8) > 1) fail.push(`harness: open panel is ${open.gap}px above its trigger, expected 8px`);
    await page.evaluate((by) => window.scrollBy(0, by), open.triggerBottom + 100);
    await settle(page);
    const away = await read();
    if (!away.mounted) fail.push("scrolled away: the panel unmounted (it should only hide)");
    if (!(away.triggerBottom < 0)) fail.push(`scrolled away: the trigger is still in view (bottom ${away.triggerBottom})`);
    if (away.visibility !== "hidden" || !away.flagged) fail.push(`scrolled away: panel not hidden (${JSON.stringify(away)})`);
    await page.evaluate((by) => window.scrollBy(0, -by), open.triggerBottom + 100);
    await settle(page);
    const back = await read();
    if (back.visibility !== "visible" || back.flagged) fail.push(`scrolled back: panel not visible (${JSON.stringify(back)})`);
    if (Math.abs(back.gap - 8) > 1) fail.push(`scrolled back: panel is ${back.gap}px above its trigger, expected 8px`);
    await page.keyboard.press("Escape");

    // ── 3. edges at 375 ──────────────────────────────────────────────────────
    const edges = (selector) =>
      page.evaluate((sel) => {
        const p = document.querySelector(sel);
        if (!p) return null;
        const probe = document.createElement("span");
        probe.style.cssText = "position: absolute; visibility: hidden; inline-size: var(--R-SIZE-2)";
        p.append(probe);
        const gap = probe.getBoundingClientRect().width;
        probe.remove();
        const r = p.getBoundingClientRect();
        return { left: r.left, right: r.right, width: r.width, gap, client: document.documentElement.clientWidth, cap: getComputedStyle(p).maxInlineSize };
      }, selector);
    const checkEdges = (what, e) => {
      if (!e) return fail.push(`${what}: no open panel found`);
      if (!(e.gap > 0)) fail.push(`harness: ${what}'s --R-SIZE-2 resolved to ${e.gap}px`);
      if (e.left < e.gap - 0.5) fail.push(`${what}: left edge ${e.left}px, inside the ${e.gap}px gap`);
      if (e.right > e.client - e.gap + 0.5) fail.push(`${what}: right edge ${e.right}px past clientWidth ${e.client} − ${e.gap}px`);
      if (!/100%/.test(e.cap) || /vw/.test(e.cap)) fail.push(`${what}: promoted cap is \`${e.cap}\`, expected one read against 100%`);
    };
    const range = await (async () => {
      const dates = await openSection(page, "dates-daterangepicker", { width: 375, height: 800 });
      const rangeTrigger = dates.getByRole("button", { name: /Last 7 days/ }).first();
      await rangeTrigger.scrollIntoViewIfNeeded();
      await rangeTrigger.click();
      await page.locator(".r-dates-range-panel:popover-open").waitFor();
      await settle(page);
      return edges(".r-dates-range-panel:popover-open");
    })();
    checkEdges("range popup", range);
    // Harness: the popup is capped (its months want more than the viewport), so it tests the cap.
    if (range && !(range.width >= range.client - 2 * range.gap - 0.5)) fail.push(`harness: range popup ${range.width}px is not at its cap (${range.client} − 2 × ${range.gap})`);
    await page.keyboard.press("Escape");

    await openPage(page, "dashboard", { width: 375, height: 800 });
    const actions = page.locator("[data-dashboard-services] tbody tr").first().getByRole("button", { name: /^Actions for / });
    await actions.scrollIntoViewIfNeeded();
    await actions.click();
    await page.locator("[role=menu]:popover-open").waitFor();
    await settle(page);
    const menu = await edges("[role=menu]:popover-open");
    checkEdges("row actions menu", menu);
    await page.keyboard.press("Escape");

    for (const e of errors) fail.push(e);
    if (fail.length) throw new Error(`sweep-floating FAILED (${fail.length}):\n  ${fail.join("\n  ")}`);
    return `sweep-floating OK (${CASES.length} floating cases × fine/coarse: in place, top layer, past the clip, the card's density, ${rowsMeasured} rows/cells/frames at the card's tokens; hides while its trigger is away; 375 edges ${JSON.stringify({ range: range && Math.round(range.left), menu: menu && Math.round(menu.left) })})`;
  } finally {
    stopErrors();
  }
}
