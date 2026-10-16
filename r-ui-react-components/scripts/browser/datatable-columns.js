// Browser check: DataTable's column features: the columns menu, resizing by pointer and by
// keyboard, and pinned columns while the table scrolls sideways, LTR and RTL.
//
// Run it through `bun run browser:check datatable-columns`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print datatable-columns)"
//
// Asserts, on the Overview's "DataTable features" demos (`[data-testid^="dt-"]`):
//   1. columns menu: the controlled demo shows the four columns its source lists; Enter on
//      "Columns" opens a menu in the top layer with one checkbox per column (Service checked and
//      unavailable); choosing Status removes that column's header and cells and the echo
//      follows; Escape closes the menu with focus back on its button;
//   2. resize by keyboard: a header's separator is valued at its drawn width; its min is two
//      `--CONTROL-H` and its max `--MEASURE` as the browser resolves them (harness: 72px min at
//      comfortable + fine); ArrowRight widens the header by one `--R-SIZE-3`, Home narrows it to
//      the min, End widens it to the max; a double click gives the column's own width back;
//   3. resize by drag: dragging the handle 60px toward the inline end widens the header by 60px
//      (±2), the value follows, and a drag far past the start stops at the min; in the RTL
//      table the same drag runs leftward and ArrowLeft widens; in the all-features table (already
//      at its own width, Service and Team truncating) a 150px drag widens Service by 150px and
//      Team keeps at least its min: the table grows instead of squeezing a neighbour away;
//   4. pinned columns: the narrow demo scrolls sideways; scrolled by 160px, the checkbox and
//      Service cells keep their place (±1) while a later cell moves by the scroll, the pinned
//      cell wins a hit test at its centre, and the pinned edge draws its rule only while
//      scrolled; in the RTL all-features table the pinned cells keep their right edge; in the
//      all-features table scrolled both ways, the pinned head cell still wins its hit test;
//   5. at coarse input a handle is half the hit floor wide (22px); under forced colours the
//      scrolled edge's rule still paints.
async (page) => {
  const base = page.url().split("#")[0];
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /datatable|data-table|DataTable/.test(text) });

  const load = async (view, width = 1280) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/data-datatablefeatures`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [SHOWCASE_VIEW_KEY, view]);
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-testid="dt-all"]').waitFor();
  };
  const demo = (id) => page.locator(`[data-testid="${id}"]`);
  const keyedHeaders = (id) =>
    demo(id).evaluate((frame) => [...frame.querySelectorAll("thead tr:first-child > [data-column-key]")].map((h) => h.dataset.columnKey));
  const headerWidth = (id, key) =>
    demo(id).evaluate((frame, k) => frame.querySelector(`thead tr:first-child > [data-column-key="${k}"]`).getBoundingClientRect().width, key);
  const resolve = (id, css) =>
    demo(id).evaluate((frame, value) => {
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;inline-size:${value}`;
      frame.querySelector("thead th").appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    }, css);

  try {
    await load({ theme: "default", density: "comfortable", input: "fine" });

    // 1. Columns menu.
    const cols = demo("dt-columns");
    await cols.scrollIntoViewIfNeeded();
    const before = await keyedHeaders("dt-columns");
    if (before.join() !== "name,status,p95,errors") problems.push(`harness: the columns demo shows ${before.join()}, its source name,status,p95,errors`);
    const trigger = cols.getByRole("button", { name: "Columns" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: "Columns" });
    await menu.waitFor();
    const menuFacts = await menu.evaluate((el) => ({
      top: el.matches(":popover-open"),
      items: [...el.querySelectorAll('[role="menuitemcheckbox"]')].map((i) => ({
        name: i.textContent.trim(),
        checked: i.getAttribute("aria-checked"),
        disabled: i.getAttribute("aria-disabled") === "true",
      })),
    }));
    if (!menuFacts.top) problems.push("columns: the menu is not in the top layer");
    if (menuFacts.items.length !== 9) problems.push(`columns: the menu lists ${menuFacts.items.length} columns, the source 9`);
    const service = menuFacts.items.find((i) => i.name === "Service");
    if (!service?.disabled || service.checked !== "true") problems.push(`columns: Service (required) is ${JSON.stringify(service)}`);
    await menu.getByRole("menuitemcheckbox", { name: "Status" }).click();
    const after = await keyedHeaders("dt-columns");
    if (after.join() !== "name,p95,errors") problems.push(`columns: after hiding Status the head is ${after.join()}`);
    const statusCells = await cols.locator("tbody td").filter({ hasText: /^(Healthy|Warning|Degraded|Down|No data)$/ }).count();
    if (statusCells !== 0) problems.push(`columns: ${statusCells} status cells remain after hiding Status`);
    const echo = await cols.evaluate((frame) => frame.parentElement.textContent);
    if (echo.includes("status")) problems.push("columns: the controlled echo still lists status");
    await page.keyboard.press("Escape");
    if (!(await trigger.evaluate((el) => el === document.activeElement))) problems.push("columns: Escape did not return focus to the Columns button");
    // The menu fades out (an overlay exit) before it is gone.
    const closed = await menu.waitFor({ state: "hidden", timeout: 1000 }).then(
      () => true,
      () => false,
    );
    if (!closed) problems.push("columns: Escape left the menu open");

    // 2. Resize by keyboard.
    const resize = demo("dt-resize");
    await resize.scrollIntoViewIfNeeded();
    const handle = resize.getByRole("separator", { name: "Resize Service" });
    const controlH = await resize.evaluate((el) => Number.parseFloat(getComputedStyle(el).getPropertyValue("--CONTROL-H")));
    const min = Number(await handle.getAttribute("aria-valuemin"));
    const max = Number(await handle.getAttribute("aria-valuemax"));
    if (controlH !== 36 || min !== 72) problems.push(`harness: --CONTROL-H ${controlH}px, min ${min}px; the source predicts 36px and 72px`);
    const measure = Math.round(await resolve("dt-resize", "var(--MEASURE)"));
    if (Math.abs(max - measure) > 1) problems.push(`resize: max ${max}px, --MEASURE resolves to ${measure}px`);
    const step = await resolve("dt-resize", "var(--R-SIZE-3)");
    const colW = () => resize.evaluate((frame) => frame.querySelector('[data-column-key="name"]').style.getPropertyValue("--col-w"));
    const startW = await colW();
    const w0 = await headerWidth("dt-resize", "name");
    const now0 = Number(await handle.getAttribute("aria-valuenow"));
    if (Math.abs(now0 - w0) > 1) problems.push(`resize: the separator says ${now0}px, the header is ${w0}px`);
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    const w1 = await headerWidth("dt-resize", "name");
    if (Math.abs(w1 - (w0 + step)) > 1) problems.push(`resize: ArrowRight made the header ${w1}px, expected ${w0} + ${step}`);
    await page.keyboard.press("Home");
    const wMin = await headerWidth("dt-resize", "name");
    if (Math.abs(wMin - min) > 1) problems.push(`resize: Home made the header ${wMin}px, the min is ${min}px`);
    await page.keyboard.press("End");
    const wMax = await headerWidth("dt-resize", "name");
    if (Math.abs(wMax - max) > 1) problems.push(`resize: End made the header ${wMax}px, the max is ${max}px`);
    await handle.dblclick();
    const reset = await colW();
    if (reset !== startW) problems.push(`resize: a double click left the width at ${reset}, the column's own is ${startW || "automatic"}`);
    summary.keyboard = `${w0}→${w1}, ${min}..${max}`;

    // 3. Resize by drag, LTR then RTL.
    const drag = async (id, by) => {
      const h = demo(id).getByRole("separator", { name: "Resize Service" });
      await h.scrollIntoViewIfNeeded();
      const box = await h.boundingBox();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + by / 2, y, { steps: 4 });
      await page.mouse.move(x + by, y, { steps: 4 });
      await page.mouse.up();
      return h;
    };
    const d0 = await headerWidth("dt-resize", "name");
    const dh = await drag("dt-resize", 60);
    const d1 = await headerWidth("dt-resize", "name");
    if (Math.abs(d1 - (d0 + 60)) > 2) problems.push(`drag: 60px toward the end made the header ${d1}px from ${d0}px`);
    if (Math.abs(Number(await dh.getAttribute("aria-valuenow")) - d1) > 1) problems.push("drag: the separator's value does not follow the header");
    await drag("dt-resize", -2000);
    const d2 = await headerWidth("dt-resize", "name");
    if (Math.abs(d2 - min) > 1) problems.push(`drag: a drag far past the start stopped at ${d2}px, the min is ${min}px`);
    summary.drag = `${d0}→${d1}→${d2}`;

    // A table already at its own width grows (and scrolls) rather than squeezing a neighbour past
    // its min: the all-features table, whose truncating Service and Team share what is left.
    const a0 = { name: await headerWidth("dt-all", "name"), team: await headerWidth("dt-all", "owner") };
    await drag("dt-all", 150);
    const a1 = { name: await headerWidth("dt-all", "name"), team: await headerWidth("dt-all", "owner") };
    if (Math.abs(a1.name - (a0.name + 150)) > 2 || a1.team < min - 1) {
      problems.push(`squeezed drag: 150px toward the end made Service ${a0.name}→${a1.name}px and Team ${a0.team}→${a1.team}px; expected Service +150 and Team no narrower than its min ${min}px`);
    }
    await demo("dt-all").getByRole("separator", { name: "Resize Service" }).dblclick();
    summary.squeezed = `${a0.name}→${a1.name}`;

    const r0 = await headerWidth("dt-all-rtl", "name");
    await drag("dt-all-rtl", -60);
    const r1 = await headerWidth("dt-all-rtl", "name");
    if (Math.abs(r1 - (r0 + 60)) > 2) problems.push(`RTL drag: 60px leftward made the header ${r1}px from ${r0}px`);
    await demo("dt-all-rtl").getByRole("separator", { name: "Resize Service" }).focus();
    await page.keyboard.press("ArrowLeft");
    const r2 = await headerWidth("dt-all-rtl", "name");
    if (!(r2 > r1 + 0.5)) problems.push(`RTL: ArrowLeft did not widen (${r1}px → ${r2}px)`);

    // 4. Pinned columns.
    const pinned = async (id, scroll) => {
      await demo(id).scrollIntoViewIfNeeded();
      return demo(id).evaluate(async (frame, by) => {
        // The edge's rule follows a scroll listener and a render: wait two frames after a scroll.
        const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const row = frame.querySelector("tbody > tr[data-table-row]");
        // Columns a narrow container drops are display: none and have no box.
        const cells = [...row.children].filter((c) => c.getClientRects().length > 0);
        const edgeCell = row.querySelector("[data-sticky-edge]");
        const later = cells[cells.length - 1];
        const read = () => ({
          box: cells[0].getBoundingClientRect(),
          edge: edgeCell.getBoundingClientRect(),
          later: later.getBoundingClientRect(),
          rule: getComputedStyle(edgeCell, "::after").content,
        });
        frame.scrollLeft = 0;
        await settle();
        const a = read();
        frame.scrollLeft = by;
        await settle();
        const scrolled = Math.abs(frame.scrollLeft);
        const b = read();
        const cx = (b.edge.left + b.edge.right) / 2;
        const cy = (b.edge.top + b.edge.bottom) / 2;
        const hit = document.elementFromPoint(cx, cy);
        const out = {
          scrolls: frame.scrollWidth > frame.clientWidth + 100,
          pinnedCount: row.querySelectorAll(".r-data-table-sticky").length,
          scrolled,
          firstMoved: Math.max(Math.abs(b.box.left - a.box.left), Math.abs(b.box.right - a.box.right)),
          edgeMoved: Math.max(Math.abs(b.edge.left - a.edge.left), Math.abs(b.edge.right - a.edge.right)),
          laterMoved: Math.abs(b.later.left - a.later.left),
          hitInEdge: Boolean(hit && edgeCell.contains(hit)),
          ruleBefore: a.rule,
          ruleAfter: b.rule,
        };
        frame.scrollLeft = 0;
        return out;
      }, scroll);
    };

    const ltr = await pinned("dt-sticky", 160);
    if (!ltr.scrolls) problems.push("harness: the pinned demo does not scroll sideways");
    if (ltr.pinnedCount !== 2) problems.push(`pinned: ${ltr.pinnedCount} pinned cells in a row, expected the checkbox and Service`);
    if (Math.abs(ltr.scrolled - 160) > 1) problems.push(`harness: the pinned demo scrolled ${ltr.scrolled}px of 160`);
    if (ltr.firstMoved > 1 || ltr.edgeMoved > 1) problems.push(`pinned: scrolled 160px the pinned cells moved ${ltr.firstMoved}/${ltr.edgeMoved}px`);
    if (Math.abs(ltr.laterMoved - ltr.scrolled) > 1) problems.push(`pinned: a later cell moved ${ltr.laterMoved}px for a ${ltr.scrolled}px scroll`);
    if (!ltr.hitInEdge) problems.push("pinned: the pinned Service cell loses the hit test at its centre to a cell scrolled under it");
    if (ltr.ruleBefore !== "none") problems.push(`pinned: the edge draws a rule before any scroll (${ltr.ruleBefore})`);
    if (ltr.ruleAfter === "none") problems.push("pinned: the edge draws no rule while scrolled");

    const rtl = await pinned("dt-all-rtl", -160);
    if (rtl.firstMoved > 1 || rtl.edgeMoved > 1) problems.push(`RTL pinned: scrolled the pinned cells moved ${rtl.firstMoved}/${rtl.edgeMoved}px`);
    if (Math.abs(rtl.laterMoved - rtl.scrolled) > 1 || rtl.scrolled < 100) problems.push(`RTL pinned: a later cell moved ${rtl.laterMoved}px for a ${rtl.scrolled}px scroll`);
    if (!rtl.hitInEdge) problems.push("RTL pinned: the pinned cell loses its hit test");
    summary.pinned = `${ltr.scrolled}px LTR, ${rtl.scrolled}px RTL`;

    // 4b. Scrolled both ways under a sticky head: the pinned head cell stays on top.
    await demo("dt-all").scrollIntoViewIfNeeded();
    const corner = await demo("dt-all").evaluate((frame) => {
      frame.scrollTop = frame.scrollHeight;
      frame.scrollLeft = 200;
      const th = frame.querySelector('thead tr:first-child > [data-column-key="name"]');
      const r = th.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const ok = Boolean(hit && th.contains(hit));
      frame.scrollTop = 0;
      frame.scrollLeft = 0;
      return ok;
    });
    if (!corner) problems.push("pinned: scrolled down and sideways, the pinned head cell loses its hit test");

    // 5a. Forced colours keep the scrolled edge's rule.
    await page.emulateMedia({ forcedColors: "active" });
    const forcedRule = await demo("dt-sticky").evaluate(async (frame) => {
      frame.scrollLeft = 160;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const edge = frame.querySelector("tbody [data-sticky-edge]");
      const after = getComputedStyle(edge, "::after");
      const out = { content: after.content, width: Number.parseFloat(after.borderInlineEndWidth), color: after.borderInlineEndColor, bg: getComputedStyle(edge).backgroundColor };
      frame.scrollLeft = 0;
      return out;
    });
    if (forcedRule.content === "none" || !(forcedRule.width > 0) || forcedRule.color === forcedRule.bg) {
      problems.push(`forced colours: the scrolled edge's rule does not paint ${JSON.stringify(forcedRule)}`);
    }
    await page.emulateMedia({ forcedColors: "none" });

    // 5b. Coarse: a handle is half the hit floor.
    await load({ theme: "default", density: "comfortable", input: "coarse" });
    await demo("dt-resize").scrollIntoViewIfNeeded();
    const coarse = {
      handle: await demo("dt-resize").evaluate((frame) => frame.querySelector('[role="separator"]').getBoundingClientRect().width),
      // --HIT-MIN is not a registered length, so it reads back as written: resolve it.
      hit: await resolve("dt-resize", "var(--HIT-MIN)"),
    };
    if (coarse.hit !== 44) problems.push(`harness: --HIT-MIN at coarse is ${coarse.hit}px, the source predicts 44px`);
    if (Math.abs(coarse.handle - coarse.hit / 2) > 0.5) problems.push(`coarse: a resize handle is ${coarse.handle}px wide, expected ${coarse.hit / 2}px`);

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none" });
  }

  if (problems.length) throw new Error(`datatable-columns FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `datatable-columns OK (${JSON.stringify(summary)})`;
}
