// Browser check: density re-derives at every boundary, both ways, and floating
// panels opened inside a clipping compact card are compact, unclipped and live.
//
// On the Stress page (default theme, comfortable page) it asserts:
//   1. harness: at fine input the comfortable reference card resolves --ROW-H to
//      40px and the compact cards to 30px, as the source predicts
//      (max(2.5rem | 1.875rem, 1.5rem));
//   2. a compact card inside a prose region inside a comfortable box, and a
//      compact card at the top of that box: rendered table rows, buttons and
//      selects are the compact heights (30 / 28 / 28px) and the body-cell text is
//      smaller than the reference's;
//   3. a comfortable card inside the compact one is comfortable AGAIN: rows,
//      buttons, selects, cell text and title text equal the reference card's;
//   4. (C5) the DropdownMenu opened from the compact card with overflow: hidden
//      is a DOM descendant of the card (in place, never portalled), sits in the top
//      layer (:popover-open), has items exactly the card's --ROW-H (30px, not the
//      page's 40px), reaches past the card's clip box, and an item lying outside
//      that box takes the press (elementFromPoint);
//   5. the Popover, opened the same way, is in the top layer, reaches past the
//      clip box, is hit-testable outside it and its input's frame is the compact
//      --CONTROL-H; the Tooltip (opened by focus) is in the top layer past the
//      clip box and compact too (it resolves the card's --ROW-H, not the page's, and
//      its inline padding is --R-SIZE-5 as resolved in the card); the native Select
//      is the compact --CONTROL-H;
//   6. (C5) with html data-input="coarse": every row and control in the compact
//      cards, and every item of the opened menu, is at least 44px.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const setView = async (input) => {
    await page.goto(`${base}#/stress`);
    await page.evaluate((v) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(v)), {
      theme: "default",
      density: "comfortable",
      input,
    });
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-testid="stress-comfortable-in-compact"]').waitFor();
    await page.waitForTimeout(300);
  };

  await page.setViewportSize({ width: 1280, height: 900 });
  await setView("fine");

  // ── 1–3: the nesting panel ───────────────────────────────────────────────
  const cards = await page.evaluate(() => {
    const ids = ["stress-comfortable-reference", "stress-compact-in-prose", "stress-compact-outer", "stress-comfortable-in-compact"];
    const px = (v) => Math.round(Number.parseFloat(v) * 100) / 100;
    return Object.fromEntries(
      ids.map((id) => {
        const card = document.querySelector(`[data-testid="${id}"]`);
        // Only this card's own parts, not those of a card nested inside it.
        const own = (sel) => [...card.querySelectorAll(sel)].filter((e) => e.closest('[data-testid^="stress-"]') === card);
        const h = (el) => (el ? px(el.getBoundingClientRect().height) : null);
        const row = own("tbody tr")[0];
        const cell = own("tbody td")[0];
        const title = own("h3, h4, h5, h6, [class*='text-h']")[0];
        return [
          id,
          {
            token: px(getComputedStyle(card).getPropertyValue("--ROW-H")),
            control: px(getComputedStyle(card).getPropertyValue("--CONTROL-H")),
            row: h(row),
            button: h(own('[data-probe="button"]')[0]),
            select: h(own("select")[0]),
            cellText: cell ? px(getComputedStyle(cell).fontSize) : null,
            titleText: title ? px(getComputedStyle(title).fontSize) : null,
          },
        ];
      }),
    );
  });
  const ref = cards["stress-comfortable-reference"];
  if (ref.token !== 40) fail.push(`harness: the comfortable reference resolves --ROW-H ${ref.token}px, source predicts 40px`);
  for (const id of ["stress-compact-in-prose", "stress-compact-outer"]) {
    const c = cards[id];
    if (c.token !== 30) fail.push(`harness: ${id} resolves --ROW-H ${c.token}px, source predicts 30px`);
    if (c.row !== 30) fail.push(`${id}: a table row is ${c.row}px, compact --ROW-H is 30px`);
    if (c.button !== 28) fail.push(`${id}: a button is ${c.button}px, compact --CONTROL-H is 28px`);
    if (c.select !== 28) fail.push(`${id}: the select is ${c.select}px, compact --CONTROL-H is 28px`);
    if (!(c.cellText < ref.cellText)) fail.push(`${id}: cell text ${c.cellText}px is not smaller than the comfortable ${ref.cellText}px`);
  }
  const back = cards["stress-comfortable-in-compact"];
  for (const key of ["token", "row", "button", "select", "cellText", "titleText"]) {
    if (back[key] === null || back[key] !== ref[key]) {
      fail.push(`comfortable inside compact: ${key} is ${back[key]}, the comfortable reference is ${ref[key]} (did not re-derive)`);
    }
  }

  // ── 4–5: floating panels from the clipping compact card ──────────────────
  const clip = page.locator('[data-testid="stress-clip-card"]');
  await clip.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="stress-clip-card"]');
    window.scrollBy(0, card.getBoundingClientRect().top - 120);
  });
  const geometry = (selector) =>
    page.evaluate((sel) => {
      const card = document.querySelector('[data-testid="stress-clip-card"]');
      const panel = document.querySelector(sel);
      if (!panel) return null;
      const c = card.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      // A point inside the panel but outside the card's clip box, if there is one.
      const y = p.bottom > c.bottom + 4 ? (Math.max(p.top, c.bottom) + p.bottom) / 2 : p.top < c.top - 4 ? (p.top + Math.min(p.bottom, c.top)) / 2 : null;
      const x = (Math.max(p.left, 0) + Math.min(p.right, innerWidth)) / 2;
      const hit = y === null ? null : document.elementFromPoint(x, y);
      return {
        inCard: card.contains(panel),
        cardOverflow: getComputedStyle(card).overflow,
        topLayer: panel.matches(":popover-open"),
        beyond: { above: Math.round(c.top - p.top), below: Math.round(p.bottom - c.bottom) },
        hitOutside: y === null ? "no part of the panel lies outside the card" : panel.contains(hit) ? "panel" : hit ? `${hit.tagName.toLowerCase()} "${hit.textContent.trim().slice(0, 20)}"` : "nothing",
        hitElement: hit && panel.contains(hit) ? hit.closest('[role^="menuitem"]')?.textContent.trim() ?? null : null,
      };
    }, selector);

  await page.getByRole("button", { name: "Row actions" }).click();
  await page.locator('[data-testid="stress-clip-card"] [role="menu"]').waitFor();
  await page.waitForTimeout(200);
  const menu = await geometry('[data-testid="stress-clip-card"] [role="menu"]');
  const items = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="stress-clip-card"]');
    const its = [...card.querySelectorAll('[role="menu"] [role="menuitem"]')];
    return {
      rowH: Number.parseFloat(getComputedStyle(card).getPropertyValue("--ROW-H")),
      pageRowH: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--ROW-H")),
      heights: its.map((i) => Math.round(i.getBoundingClientRect().height * 100) / 100),
    };
  });
  if (!menu) fail.push("the menu did not open inside the compact card");
  else {
    if (menu.cardOverflow !== "hidden") fail.push(`harness: the compact card's overflow is ${menu.cardOverflow}, expected hidden`);
    if (!menu.inCard) fail.push("the menu is not a DOM descendant of the card (portalled?)");
    if (!menu.topLayer) fail.push("the menu is not in the top layer (:popover-open)");
    if (!(menu.beyond.above > 0 || menu.beyond.below > 0)) fail.push(`the menu does not reach past the card's clip box (${JSON.stringify(menu.beyond)})`);
    if (menu.hitOutside !== "panel") fail.push(`a press on the menu outside the card's clip box reached ${menu.hitOutside}`);
  }
  if (items.rowH !== 30 || items.pageRowH !== 40) fail.push(`harness: card --ROW-H ${items.rowH}px / page ${items.pageRowH}px, source predicts 30 / 40`);
  if (items.heights.length < 8 || items.heights.some((h) => h !== items.rowH)) {
    fail.push(`menu items are ${items.heights.join(", ")}px, the compact card's --ROW-H is ${items.rowH}px`);
  }
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Filters" }).click();
  const popoverSel = '[data-testid="stress-clip-card"] [role="dialog"][aria-label="Compact filters"]';
  await page.locator(popoverSel).waitFor();
  await page.waitForTimeout(200);
  const popover = await geometry(popoverSel);
  const popoverInput = await page.evaluate((sel) => document.querySelector(`${sel} input`)?.closest(".r-form-frame")?.getBoundingClientRect().height, popoverSel);
  if (!popover?.topLayer || !popover.inCard) fail.push(`the popover is not in place and in the top layer (${JSON.stringify(popover)})`);
  else {
    if (!(popover.beyond.above > 0 || popover.beyond.below > 0)) fail.push(`the popover does not reach past the clip box (${JSON.stringify(popover.beyond)})`);
    if (popover.hitOutside !== "panel") fail.push(`a press on the popover outside the card reached ${popover.hitOutside}`);
  }
  if (popoverInput !== 28) fail.push(`the popover's input frame is ${popoverInput}px, compact --CONTROL-H is 28px`);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Hover or focus me" }).focus();
  const tipSel = '[data-testid="stress-clip-card"] [role="tooltip"]';
  await page.locator(tipSel).waitFor();
  await page.waitForTimeout(200);
  const tip = await geometry(tipSel);
  if (!tip?.topLayer || !tip.inCard) fail.push(`the tooltip is not in place and in the top layer (${JSON.stringify(tip)})`);
  else if (!(tip.beyond.above > 0 || tip.beyond.below > 0)) fail.push(`the tooltip does not reach past the clip box (${JSON.stringify(tip.beyond)})`);
  const tipDensity = await page.evaluate((sel) => {
    const card = document.querySelector('[data-testid="stress-clip-card"]');
    const panel = document.querySelector(sel);
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;padding-inline-start:var(--R-SIZE-5)";
    card.append(probe);
    const cardPad = getComputedStyle(probe).paddingInlineStart;
    probe.remove();
    return {
      rowH: Number.parseFloat(getComputedStyle(panel).getPropertyValue("--ROW-H")),
      pad: getComputedStyle(panel).paddingInlineStart,
      cardPad,
    };
  }, tipSel);
  if (tipDensity.rowH !== 30) fail.push(`the tooltip resolves --ROW-H ${tipDensity.rowH}px, the compact card's is 30px (page 40px)`);
  if (tipDensity.pad !== tipDensity.cardPad) fail.push(`the tooltip's inline padding is ${tipDensity.pad}, --R-SIZE-5 in the compact card is ${tipDensity.cardPad}`);
  await page.keyboard.press("Escape");
  const nativeSelect = await page.evaluate(
    () => document.querySelector('[data-testid="stress-clip-card"] select[aria-label="Time range"]').getBoundingClientRect().height,
  );
  if (nativeSelect !== 28) fail.push(`the select in the compact card is ${nativeSelect}px, compact --CONTROL-H is 28px`);

  // ── 6: coarse input lifts the compact cards to the 44px floor ────────────
  await setView("coarse");
  const coarse = await page.evaluate(() => {
    const ids = ["stress-compact-in-prose", "stress-compact-outer", "stress-clip-card"];
    const root = getComputedStyle(document.documentElement);
    const hit = Number.parseFloat(root.getPropertyValue("--HIT-MIN")) * Number.parseFloat(root.fontSize);
    const under = [];
    let measured = 0;
    for (const id of ids) {
      const card = document.querySelector(`[data-testid="${id}"]`);
      const own = [...card.querySelectorAll("tbody tr, button, select, .r-form-frame")].filter(
        (e) => e.closest('[data-testid^="stress-"]') === card && e.getBoundingClientRect().height > 0,
      );
      for (const el of own) {
        measured++;
        const h = el.getBoundingClientRect().height;
        if (h < 44) under.push(`${id}: ${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent).trim().slice(0, 24)}" ${h}px`);
      }
    }
    return { hit, measured, under };
  });
  if (coarse.hit !== 44) fail.push(`harness: --HIT-MIN at coarse is ${coarse.hit}px, source predicts 44px`);
  if (coarse.measured < 15) fail.push(`harness: only ${coarse.measured} rows and controls measured at coarse`);
  for (const u of coarse.under) fail.push(`coarse: under the 44px floor: ${u}`);
  await page.locator('[data-testid="stress-clip-card"]').scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Row actions" }).click();
  await page.locator('[data-testid="stress-clip-card"] [role="menu"]').waitFor();
  const coarseItems = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="stress-clip-card"] [role="menuitem"]')].map((i) => i.getBoundingClientRect().height),
  );
  if (coarseItems.length < 8 || coarseItems.some((h) => h < 44)) fail.push(`coarse: menu items are ${coarseItems.join(", ")}px, floor 44px`);
  await page.keyboard.press("Escape");

  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  const result = { cards, menu, items, popover, popoverInput, tip, nativeSelect, coarse: { ...coarse, menuItems: coarseItems } };
  if (fail.length) throw new Error(`stress-density FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `stress-density OK ${JSON.stringify(result)}`;
}
