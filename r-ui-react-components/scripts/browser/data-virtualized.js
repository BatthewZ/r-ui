// @covers   data/VirtualizedTable
// @sections data-virtualizedtable
// @tier     component
//
// Browser check: VirtualizedTable's window arithmetic uses the REAL --ROW-H, over 10,000 rows:
// re-measured when the page's input switches live, when a stylesheet retunes the token, and
// when the table's OWN density boundary flips while it is scrolled to the middle.
//
// jsdom has no layout and no CSS, so this is settled in a real browser. Run it through
// `bun run browser:check data-virtualized`, or by hand against a running showcase:
//
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print data-virtualized)"
//
// It throws (the run fails) on any mismatch and returns the measurements.
//
// On the VirtualizedTable section, opened alone, at compact density + coarse input:
//   1. the harness reads what the source predicts: --ROW-H = max(30px, 44px) = 44px;
//   2. a rendered row is exactly that tall (one truncated line, height on the row);
//   3. scrollHeight == rows × --ROW-H + head height, within ±2px;
//   4. scrolled to the end, the last row (aria-rowindex 10001) is mounted and
//      its bottom meets the scroll area's bottom;
//   5. switching input to fine live (no reload) re-measures (--ROW-H 30px) and
//      the scroll height follows, within ±2px;
//   6. a stylesheet added later that retunes `--ROW-H-COMPACT` to 2.25rem (no
//      attribute moves at all) re-measures too (--ROW-H 36px), and removing it
//      goes back to 30px.
// On the Stress page's own-density table (default theme, fine input, 1280 wide), the subtree
// case, mid-list, in both directions: the row height changes under a fixed scrollTop, so the
// window must be recomputed from the new height at once or the viewport shows spacer (a blank
// window) or the wrong rows:
//   7. harness: the table starts comfortable, --ROW-H 40px (source: max(2.5rem,
//      1.5rem)), 10,000 data rows, and the window is right before any flip;
//   8. scrolled to the middle, then the panel's own "Compact" segment pressed:
//      --ROW-H reads 30px at the table, scrollHeight == rows × 30 + head (±2px),
//      and at the centre of every row slot from the head down to the bottom of the
//      viewport, elementFromPoint lands on a mounted row whose aria-rowindex AND
//      "#" cell are the ones scrollTop predicts (no spacer, no stale row);
//   9. the same after flipping back to comfortable (30 → 40px) at the same depth.
async (page) => {
  const ROWS = 10000;
  const fail = [];
  const result = {};

  // 1–6: the section, page-level switches.
  {
    await openSection(page, "data-virtualizedtable", { view: { theme: "default", density: "compact", input: "coarse" } });
    const table = page.locator('[data-testid="virtual-requests"]');
    await table.waitFor();
    await page.waitForTimeout(300);

    const measure = () =>
      table.evaluate((el) => {
        const rowH = Number.parseFloat(getComputedStyle(el).getPropertyValue("--ROW-H"));
        const head = el.querySelector("thead").getBoundingClientRect().height;
        const rows = Number(el.querySelector("table").getAttribute("aria-rowcount")) - 1;
        const row = el.querySelector('tbody tr[aria-rowindex="2"]');
        return {
          rowH,
          head,
          rows,
          rowRendered: row ? row.getBoundingClientRect().height : null,
          scrollHeight: el.scrollHeight,
          expected: rows * rowH + head,
        };
      });

    const coarse = await measure();
    if (coarse.rowH !== 44) fail.push(`harness: --ROW-H at compact+coarse is ${coarse.rowH}px, source predicts 44px`);
    if (coarse.rows !== ROWS) fail.push(`aria-rowcount says ${coarse.rows} data rows, expected ${ROWS}`);
    if (coarse.rowRendered !== coarse.rowH) fail.push(`a rendered row is ${coarse.rowRendered}px, --ROW-H is ${coarse.rowH}px`);
    if (Math.abs(coarse.scrollHeight - coarse.expected) > 2) {
      fail.push(`scrollHeight ${coarse.scrollHeight} != ${coarse.rows} × ${coarse.rowH} + ${coarse.head} = ${coarse.expected}`);
    }

    const end = await table.evaluate(async (el) => {
      el.scrollTop = el.scrollHeight;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const last = el.querySelector(`tbody tr[aria-rowindex="${10001}"]`);
      if (!last) return { mounted: false };
      return {
        mounted: true,
        gap: el.getBoundingClientRect().bottom - el.clientTop - last.getBoundingClientRect().bottom,
      };
    });
    if (!end.mounted) fail.push("scrolled to the end, the last row is not mounted");
    else if (Math.abs(end.gap) > 2) fail.push(`scrolled to the end, the last row ends ${end.gap}px from the bottom`);

    // Re-measure without a reload.
    await setView(page, { input: "fine" });
    await page.waitForTimeout(200);
    const fine = await measure();
    if (fine.rowH !== 30) fail.push(`after forcing fine input, --ROW-H is ${fine.rowH}px, expected 30px`);
    if (Math.abs(fine.scrollHeight - fine.expected) > 2) {
      fail.push(`after re-measure, scrollHeight ${fine.scrollHeight} != ${fine.rows} × ${fine.rowH} + ${fine.head} = ${fine.expected}`);
    }

    // A stylesheet change moves --ROW-H with no attribute change: the probe must see it.
    const retune = (on) =>
      page.evaluate((add) => {
        const id = "browser-check-row-retune";
        if (add) {
          const style = document.createElement("style");
          style.id = id;
          style.textContent = ":root { --ROW-H-COMPACT: 2.25rem; }";
          document.head.append(style);
        } else document.getElementById(id)?.remove();
      }, on);
    await retune(true);
    await page.waitForTimeout(200);
    const retuned = await measure();
    await retune(false);
    await page.waitForTimeout(200);
    const restored = await measure();
    if (retuned.rowH !== 36) fail.push(`after a stylesheet retunes --ROW-H-COMPACT, --ROW-H is ${retuned.rowH}px, expected 36px`);
    for (const [label, m] of [["retuned", retuned], ["restored", restored]]) {
      if (Math.abs(m.scrollHeight - m.expected) > 2) {
        fail.push(`${label}: scrollHeight ${m.scrollHeight} != ${m.rows} × ${m.rowH} + ${m.head} = ${m.expected}`);
      }
    }
    if (restored.rowH !== 30) fail.push(`after the stylesheet is removed, --ROW-H is ${restored.rowH}px, expected 30px`);
    Object.assign(result, { coarse, end, fine, retuned, restored });
  }

  // 7–9: the Stress page's own density boundary, flipped mid-list.
  {
    const base = page.url().split("#")[0];
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}#/stress/stress-virtual`);
    await page.evaluate(() =>
      localStorage.setItem("r-ui-showcase:view", JSON.stringify({ theme: "default", density: "comfortable", input: "fine" })),
    );
    await page.reload();
    await waitForShowcase(page);
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
    Object.assign(result, { middle: brief(middle), compact: brief(compact), comfortable: brief(comfortable) });
  }

  if (fail.length) throw new Error(`data-virtualized FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `data-virtualized OK ${JSON.stringify(result)}`;
}
