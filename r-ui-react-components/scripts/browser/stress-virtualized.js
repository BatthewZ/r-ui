// Browser check: a 10,000-row VirtualizedTable whose OWN density boundary flips
// while it is scrolled to the middle.
//
// data-virtualized-rows.js covers the page-level input switch at the END of the
// list; this is the subtree case, mid-list, in both directions. The row height
// changes under a fixed scrollTop, so the window must be recomputed from the new
// height at once or the viewport shows spacer (a blank window) or the wrong rows.
//
// Default theme, fine input, 1280 wide. Asserts:
//   1. harness: the table starts comfortable, --ROW-H 40px (source: max(2.5rem,
//      1.5rem)), 10,000 data rows, and the window is right before any flip;
//   2. scrolled to the middle, then the panel's own "Compact" segment pressed:
//      --ROW-H reads 30px at the table, scrollHeight == rows × 30 + head (±2px),
//      and at the centre of every row slot from the head down to the bottom of the
//      viewport, elementFromPoint lands on a mounted row whose aria-rowindex AND
//      "#" cell are the ones scrollTop predicts (no spacer, no stale row);
//   3. the same after flipping back to comfortable (30 → 40px) at the same depth.
async (page) => {
  const ROWS = 10000;
  const base = page.url().split("#")[0];
  const fail = [];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}#/stress/stress-virtual`);
  await page.evaluate(() =>
    localStorage.setItem("r-ui-showcase:view", JSON.stringify({ theme: "default", density: "comfortable", input: "fine" })),
  );
  await page.reload();
  const table = page.locator('[data-testid="stress-virtual"]');
  await table.waitFor();
  await table.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);

  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const measure = () =>
    table.evaluate((el) => {
      const rowH = Number.parseFloat(getComputedStyle(el).getPropertyValue("--ROW-H"));
      const head = el.querySelector("thead").getBoundingClientRect().height;
      const rows = Number(el.querySelector("table").getAttribute("aria-rowcount")) - 1;
      const box = el.getBoundingClientRect();
      const top = box.top + el.clientTop;
      const x = box.left + el.clientLeft + 12;
      const slots = [];
      // Every row slot whose centre is inside the viewport below the sticky head.
      for (let y = top + head + rowH / 2; y < top + el.clientHeight; y += rowH) {
        const expected = Math.floor((y - top - head + el.scrollTop) / rowH) + 2;
        if (expected > rows + 1) break;
        const tr = document.elementFromPoint(x, y)?.closest("tr");
        const index = tr ? Number(tr.getAttribute("aria-rowindex")) : null;
        const id = tr?.querySelector("td")?.textContent.replace(/\D/g, "") ?? null;
        slots.push({ y: Math.round(y - top), expected, index, id });
      }
      const wrong = slots.filter((s) => s.index !== s.expected || s.id !== String(s.expected - 1));
      return {
        rowH,
        head,
        rows,
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        expectedHeight: rows * rowH + head,
        slots: slots.length,
        first: slots[0] ?? null,
        wrong: wrong.slice(0, 5),
      };
    });

  const check = (label, m, rowH) => {
    if (m.rowH !== rowH) fail.push(`${label}: --ROW-H at the table is ${m.rowH}px, expected ${rowH}px`);
    if (Math.abs(m.scrollHeight - m.expectedHeight) > 2) {
      fail.push(`${label}: scrollHeight ${m.scrollHeight} != ${m.rows} × ${m.rowH} + ${m.head} = ${m.expectedHeight}`);
    }
    if (m.slots < 8) fail.push(`${label}: only ${m.slots} row slots sampled in the viewport`);
    if (m.wrong.length) fail.push(`${label}: rows on screen do not match the scroll position: ${JSON.stringify(m.wrong)}`);
  };

  const flip = async (name) => {
    // The radio itself is visually hidden; a user presses its visible segment.
    await page.getByRole("radiogroup", { name: "Table density" }).locator("label").filter({ hasText: name }).click();
    await settle();
    await page.waitForTimeout(150);
  };

  const start = await measure();
  if (start.rows !== ROWS) fail.push(`harness: aria-rowcount says ${start.rows} data rows, expected ${ROWS}`);
  check("harness (comfortable, top)", start, 40);

  await table.evaluate((el) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  });
  await settle();
  await page.waitForTimeout(100);
  const middle = await measure();
  check("harness (comfortable, middle)", middle, 40);
  if (!(middle.first?.expected > 4000)) fail.push(`harness: scrolled to the middle, the first row is ${middle.first?.expected}`);

  await flip("Compact");
  const compact = await measure();
  check("after flipping to compact mid-scroll", compact, 30);

  await flip("Comfortable");
  const comfortable = await measure();
  check("after flipping back to comfortable mid-scroll", comfortable, 40);

  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  const brief = (m) => ({ rowH: m.rowH, scrollTop: m.scrollTop, scrollHeight: m.scrollHeight, expected: m.expectedHeight, slots: m.slots, first: m.first?.expected });
  const result = { middle: brief(middle), compact: brief(compact), comfortable: brief(comfortable) };
  if (fail.length) throw new Error(`stress-virtualized FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `stress-virtualized OK ${JSON.stringify(result)}`;
}
