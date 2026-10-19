// @covers   primitives/Button, primitives/Card, data/Table, form/Select
// @tier     sweep
// @cost     4
//
// Browser check: density re-derives at every boundary, both ways. (Floating panels
// opened from a clipping compact card are sweep-floating's sweep.)
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
//   4. the native Select in the clipping compact card is the compact --CONTROL-H;
//   5. with html data-input="coarse": every row and control in the compact cards is
//      at least 44px.
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

  // ── 4: the native select in the clipping compact card ───────────────────
  const nativeSelect = await page.evaluate(
    () => document.querySelector('[data-testid="stress-clip-card"] select[aria-label="Time range"]').getBoundingClientRect().height,
  );
  if (nativeSelect !== 28) fail.push(`the select in the compact card is ${nativeSelect}px, compact --CONTROL-H is 28px`);

  // ── 5: coarse input lifts the compact cards to the 44px floor ────────────
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

  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  const result = { cards, nativeSelect, coarse };
  if (fail.length) throw new Error(`stress-density FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `stress-density OK ${JSON.stringify(result)}`;
}
