// Browser check: VirtualizedTable's window arithmetic uses the REAL --ROW-H.
//
// jsdom has no layout and no CSS, so this is settled in a real browser. Run it
// against a running showcase (`bun run showcase:dev -- --port <port>`):
//
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print data-virtualized-rows)"
//
// It throws (the run fails) on any mismatch and returns the measurements.
//
// Asserts, at compact density + coarse input over 10,000 rows:
//   1. the harness reads what the source predicts: --ROW-H = max(30px, 44px) = 44px;
//   2. a rendered row is exactly that tall (one truncated line, height on the row);
//   3. scrollHeight == rows × --ROW-H + head height, within ±2px;
//   4. scrolled to the end, the last row (aria-rowindex 10001) is mounted and
//      its bottom meets the scroll area's bottom;
//   5. forcing input to fine WITHOUT a reload re-measures (--ROW-H 30px) and
//      the scroll height follows, within ±2px;
//   6. a stylesheet added later that retunes `--ROW-H-COMPACT` to 2.25rem (no
//      attribute moves at all) re-measures too (--ROW-H 36px), and removing it
//      goes back to 30px.
async (page) => {
  const ROWS = 10000;
  const target = `${page.url().split("#")[0]}#/overview/data-virtualizedtable`;
  await page.goto(target);
  await page.evaluate(() =>
    localStorage.setItem("r-ui-showcase:view", JSON.stringify({ theme: "default", density: "compact", input: "coarse" })),
  );
  await page.reload();
  await waitForShowcase(page);
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

  const fail = [];
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
  await page.evaluate(() => document.documentElement.setAttribute("data-input", "fine"));
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

  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  const result = { coarse, end, fine, retuned, restored };
  if (fail.length) throw new Error(`data-virtualized-rows FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `data-virtualized-rows OK ${JSON.stringify(result)}`;
}
