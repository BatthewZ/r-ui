// @covers   data/DataTable
// @sections data-datatablefeatures data-datatableserver
// @tier     component
//
// Browser check: DataTable's column and row features, with real keys, focus and layout: the
// columns menu, resizing by pointer and by keyboard, pinned columns while the table scrolls
// sideways (LTR and RTL), detail rows, the bulk bar, filters and pages.
//
// Run it through `bun run browser:check data-datatable`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print data-datatable)"
//
// Asserts, on the "DataTable features" section's demos (`[data-testid^="dt-"]`; at 375 also the
// server demo's), at comfortable + fine unless said:
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
//   5. under forced colours the scrolled edge's rule still paints;
//   6. expand by keyboard: Tab from the head's first sort button reaches the first row's
//      disclosure button; Enter opens a detail row directly under its row (named by the
//      button's aria-controls), one cell spanning every column and as wide as the table, with
//      a leading marker drawn; focus stays on the button; Space closes it;
//   7. bulk bar: three row checkboxes pressed → a "Selected rows" group shows "3 selected", the
//      status says it, the bar lies inside the table's frame; with 25 rows to a page in the
//      bounded all-features table, scrolled to the top with rows below it, the bar sits on the
//      frame's bottom edge (sticky, in the sticky layer); "Clear selection" by Enter removes it, unchecks every
//      row and puts focus on select-all;
//   8. filters: the filtered demo starts on Healthy only (every row says so); Clear filters
//      shows all 16; typing "checkout" in the name filter leaves exactly that row;
//   9. pages: the pager is laid out after the range text, inside the frame; five rows and
//      "1–5 of 48" with ten pages; choosing 10 rows per page shows ten rows, "1–10 of 48"
//      and five pages; Next page shows "11–20 of 48" and other rows;
//  10. at coarse input a column's resize handle is half the hit floor wide (22px);
//  11. at 375 and coarse input, the pager and the bulk bar stay inside their frame and the
//      page does not scroll sideways.
async (page) => {
  const problems = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page, { filter: (text) => /datatable|data-table|DataTable/.test(text) });

  const load = async (view, width = 1280, sections = "data-datatablefeatures") => {
    await openSection(page, sections, { view, width });
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
  const bodyRowCount = (id) => demo(id).locator("tbody > tr[data-table-row]").count();

  try {
    await load({ theme: "default", density: "comfortable", input: "fine" });

    // The column features first: the row features below read none of the demos they resize or
    // hide a column in, and the all-features table gets its own width and scroll back.
    {
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

      // 5. Forced colours keep the scrolled edge's rule.
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
    }

    {
      // 6. Expand by keyboard.
      const expand = demo("dt-expand");
      await expand.scrollIntoViewIfNeeded();
      const toggles = expand.getByRole("button", { name: /^Details for / });
      const toggleCount = await toggles.count();
      if (toggleCount !== 5) problems.push(`harness: the expand demo has ${toggleCount} disclosure buttons, its source 5 rows`);
      const openAtStart = await expand.locator("[data-table-detail]").count();
      if (openAtStart !== 1) problems.push(`harness: the expand demo opens one row to start, found ${openAtStart}`);
      await expand.getByRole("button", { name: "Service" }).focus();
      let reached = false;
      for (let i = 0; i < 8 && !reached; i++) {
        await page.keyboard.press("Tab");
        reached = await page.evaluate(() => /^Details for /.test(document.activeElement?.getAttribute("aria-label") ?? ""));
      }
      if (!reached) problems.push("expand: Tab from the head never reached a row's disclosure button");
      const first = toggles.first();
      if (!(await first.evaluate((el) => el === document.activeElement))) problems.push("expand: the first disclosure button Tab reaches is not the first row's");
      if ((await first.getAttribute("aria-expanded")) !== "false") problems.push("expand: the first row starts open");
      await page.keyboard.press("Enter");
      const opened = await first.evaluate((button) => {
        const id = button.getAttribute("aria-controls");
        const detail = id ? document.getElementById(id) : null;
        const row = button.closest("tr");
        const table = button.closest("table");
        const cell = detail?.querySelector("td");
        const heads = table.querySelectorAll("thead tr:first-child > th").length;
        return {
          expanded: button.getAttribute("aria-expanded"),
          focused: document.activeElement === button,
          found: Boolean(detail),
          under: detail?.previousElementSibling === row,
          span: Number(cell?.getAttribute("colspan")),
          heads,
          widthGap: cell ? Math.abs(cell.getBoundingClientRect().width - table.getBoundingClientRect().width) : null,
          marker: cell ? getComputedStyle(cell).boxShadow : "none",
          text: detail?.textContent ?? "",
        };
      });
      if (opened.expanded !== "true" || !opened.found || !opened.under) problems.push(`expand: Enter did not open a detail row under its row ${JSON.stringify(opened)}`);
      if (!opened.focused) problems.push("expand: focus left the disclosure button after Enter");
      if (opened.span !== opened.heads || opened.heads < 4) problems.push(`expand: the detail cell spans ${opened.span} of ${opened.heads} columns`);
      if (!(opened.widthGap <= 1)) problems.push(`expand: the detail cell is ${opened.widthGap}px off the table's width`);
      if (opened.marker === "none" || !opened.marker.includes("inset")) problems.push(`expand: the detail cell draws no leading marker (${opened.marker})`);
      await page.keyboard.press(" ");
      if ((await first.getAttribute("aria-expanded")) !== "false") problems.push("expand: Space did not close the detail row");
      if ((await expand.locator("[data-table-detail]").count()) !== openAtStart) problems.push("expand: closing left a detail row behind");
      summary.expand = `${opened.span} columns`;

      // 7. Bulk bar: three rows, inside the frame, then cleared by keyboard.
      const bulk = demo("dt-bulk");
      await bulk.scrollIntoViewIfNeeded();
      const rowBoxes = bulk.locator('tbody input[type="checkbox"]');
      if ((await rowBoxes.count()) !== 6) problems.push(`harness: the bulk demo has ${await rowBoxes.count()} row checkboxes, its source 6 rows`);
      if ((await bulk.getByRole("group", { name: "Selected rows" }).count()) !== 0) problems.push("bulk: a bar shows before anything is selected");
      for (let i = 0; i < 3; i++) await rowBoxes.nth(i).check();
      const bar = bulk.getByRole("group", { name: "Selected rows" });
      const shown = await bulk.evaluate((frame) => {
        const group = frame.querySelector('[role="group"][data-table-bulk]');
        const status = frame.querySelector('[role="status"]');
        if (!group) return null;
        const g = group.getBoundingClientRect();
        const f = frame.getBoundingClientRect();
        return {
          text: group.textContent,
          status: status?.textContent ?? null,
          inside: g.left >= f.left - 0.5 && g.right <= f.right + 0.5 && g.bottom <= f.bottom + 0.5 && g.top >= f.top - 0.5,
        };
      });
      if (!shown) problems.push("bulk: no bar after three rows were selected");
      else {
        if (!shown.text.includes("3 selected")) problems.push(`bulk: the bar says "${shown.text}"`);
        if (shown.status !== "3 selected") problems.push(`bulk: the status says "${shown.status}"`);
        if (!shown.inside) problems.push("bulk: the bar is not inside the table's frame");
      }
      await bar.getByRole("button", { name: "Clear selection" }).focus();
      await page.keyboard.press("Enter");
      const cleared = await bulk.evaluate((frame) => ({
        bar: Boolean(frame.querySelector("[data-table-bulk]")),
        checked: frame.querySelectorAll('tbody input[type="checkbox"]:checked').length,
        focus: document.activeElement?.getAttribute("aria-label"),
        status: frame.querySelector('[role="status"]')?.textContent,
      }));
      if (cleared.bar || cleared.checked !== 0) problems.push(`bulk: Clear selection left ${JSON.stringify(cleared)}`);
      if (cleared.focus !== "Select all rows") problems.push(`bulk: after Clear selection focus is on "${cleared.focus}", expected select-all`);
      if (cleared.status !== "") problems.push(`bulk: the status still says "${cleared.status}"`);

      // 7b. Sticky to the frame's bottom while rows scroll under it.
      const all = demo("dt-all");
      await all.scrollIntoViewIfNeeded();
      await all.getByRole("combobox", { name: "Rows per page" }).selectOption("25");
      const allBoxes = all.locator('tbody input[type="checkbox"]');
      for (let i = 0; i < 3; i++) await allBoxes.nth(i).check();
      const stuck = await all.evaluate((frame) => {
        frame.scrollTop = 0;
        const footer = frame.querySelector(".r-data-table-footer");
        const group = frame.querySelector("[data-table-bulk]");
        const f = frame.getBoundingClientRect();
        const innerBottom = f.top + frame.clientTop + frame.clientHeight;
        const layer = getComputedStyle(document.documentElement).getPropertyValue("--LAYER-STICKY").trim();
        return {
          scrolls: frame.scrollHeight > frame.clientHeight + 10,
          footerBottom: footer?.getBoundingClientRect().bottom ?? null,
          innerBottom,
          group: Boolean(group),
          position: footer ? getComputedStyle(footer).position : null,
          z: footer ? getComputedStyle(footer).zIndex : null,
          layer,
        };
      });
      if (!stuck.scrolls) problems.push("harness: the all-features table at 25 rows a page does not scroll inside its frame");
      if (!stuck.group) problems.push("bulk (all): no bar after three rows were selected");
      if (stuck.position !== "sticky" || stuck.z !== stuck.layer) problems.push(`bulk (all): footer ${stuck.position} at z ${stuck.z}, expected sticky at --LAYER-STICKY ${stuck.layer}`);
      if (stuck.footerBottom === null || Math.abs(stuck.footerBottom - stuck.innerBottom) > 1) {
        problems.push(`bulk (all): scrolled to the top, the bar ends ${stuck.footerBottom === null ? "nowhere" : (stuck.innerBottom - stuck.footerBottom).toFixed(1) + "px"} above the frame's bottom edge`);
      }
      await all.getByRole("button", { name: "Clear selection" }).click();

      // 8. Filters narrow rows.
      const filtered = demo("dt-filters");
      await filtered.scrollIntoViewIfNeeded();
      const startRows = await filtered.evaluate((frame) =>
        [...frame.querySelectorAll("tbody > tr[data-table-row]")].map((r) => r.textContent.includes("Healthy")),
      );
      if (startRows.length === 0) problems.push("harness: the filtered demo shows no row on Healthy");
      if (startRows.some((healthy) => !healthy)) problems.push("filters: a row that is not Healthy passes the Healthy filter");
      await filtered.locator("thead").getByRole("button", { name: "Clear filters" }).click();
      const allRows = await bodyRowCount("dt-filters");
      if (allRows !== 16) problems.push(`filters: Clear filters shows ${allRows} rows, the source 16`);
      await filtered.getByRole("textbox", { name: "Filter Service" }).focus();
      await page.keyboard.type("checkout");
      const narrowed = await filtered.evaluate((frame) =>
        [...frame.querySelectorAll("tbody > tr[data-table-row]")].map((r) => r.querySelector("td")?.textContent),
      );
      if (narrowed.length !== 1 || narrowed[0] !== "checkout") problems.push(`filters: "checkout" leaves ${JSON.stringify(narrowed)}`);
      summary.filters = `${startRows.length} healthy → ${allRows} → ${narrowed.length}`;

      // 9. Pages.
      const pages = demo("dt-pages");
      await pages.scrollIntoViewIfNeeded();
      const pagerState = () =>
        pages.evaluate((frame) => ({
          rows: [...frame.querySelectorAll("tbody > tr[data-table-row]")].map((r) => r.querySelector("td")?.textContent),
          range: frame.querySelector('[data-table-pagination] [aria-live="polite"]')?.textContent,
          last: Math.max(
            0,
            ...[...frame.querySelectorAll("nav button")].map((b) => Number(/^Page (\d+)$/.exec(b.getAttribute("aria-label") ?? "")?.[1] ?? 0)),
          ),
        }));
      // Pagination has no width of its own (a size container): the footer must give it one,
      // with its controls after the range text and inside the frame.
      const pagerBox = await pages.evaluate((frame) => {
        const range = frame.querySelector('[data-table-pagination] [aria-live="polite"]').getBoundingClientRect();
        const next = frame.querySelector('[data-table-pagination] [data-pagination="next"]').getBoundingClientRect();
        const f = frame.getBoundingClientRect();
        return { rangeRight: range.right, nextLeft: next.left, nextRight: next.right, frameRight: f.right, nav: frame.querySelector("[data-table-pagination] nav").getBoundingClientRect().width };
      });
      if (!(pagerBox.nav > 0 && pagerBox.nextLeft >= pagerBox.rangeRight && pagerBox.nextRight <= pagerBox.frameRight + 0.5)) problems.push(`pages: the pager is not laid out after the range inside the frame ${JSON.stringify(pagerBox)}`);
      const p1 = await pagerState();
      if (p1.rows.length !== 5 || p1.range !== "1–5 of 48" || p1.last !== 10) problems.push(`pages: start ${JSON.stringify(p1)}, expected 5 rows, 1–5 of 48, 10 pages`);
      await pages.getByRole("combobox", { name: "Rows per page" }).selectOption("10");
      const p2 = await pagerState();
      if (p2.rows.length !== 10 || p2.range !== "1–10 of 48" || p2.last !== 5) problems.push(`pages: at 10 a page ${JSON.stringify(p2)}, expected 10 rows, 1–10 of 48, 5 pages`);
      await pages.getByRole("button", { name: "Next page" }).click();
      const p3 = await pagerState();
      if (p3.range !== "11–20 of 48" || p3.rows.length !== 10 || p3.rows[0] === p2.rows[0]) problems.push(`pages: Next page ${JSON.stringify(p3)}`);
      summary.pages = `${p1.last}→${p2.last} pages`;
    }

    // 10. Coarse: a handle is half the hit floor.
    await load({ theme: "default", density: "comfortable", input: "coarse" });
    await demo("dt-resize").scrollIntoViewIfNeeded();
    const coarse = {
      handle: await demo("dt-resize").evaluate((frame) => frame.querySelector('[role="separator"]').getBoundingClientRect().width),
      // --HIT-MIN is not a registered length, so it reads back as written: resolve it.
      hit: await resolve("dt-resize", "var(--HIT-MIN)"),
    };
    if (coarse.hit !== 44) problems.push(`harness: --HIT-MIN at coarse is ${coarse.hit}px, the source predicts 44px`);
    if (Math.abs(coarse.handle - coarse.hit / 2) > 0.5) problems.push(`coarse: a resize handle is ${coarse.handle}px wide, expected ${coarse.hit / 2}px`);

    // 11. Narrow and coarse: the footers stay inside their frames.
    // The server demo's frame (`dt-server`) is held to the same footer claims.
    await load({ theme: "default", density: "comfortable", input: "coarse" }, 375, ["data-datatablefeatures", "data-datatableserver"]);
    await demo("dt-bulk").scrollIntoViewIfNeeded();
    const narrowBoxes = demo("dt-bulk").locator('tbody input[type="checkbox"]');
    await narrowBoxes.nth(0).check();
    const narrow = await page.evaluate(() => {
      const out = [];
      const frames = [...document.querySelectorAll('[data-testid^="dt-"]')];
      for (const frame of frames) {
        const f = frame.getBoundingClientRect();
        for (const part of frame.querySelectorAll("[data-table-bulk], [data-table-pagination]")) {
          const r = part.getBoundingClientRect();
          if (r.left < f.left - 0.5 || r.right > f.right + 0.5) out.push(`${frame.dataset.testid}: a footer runs ${Math.round(Math.max(f.left - r.left, r.right - f.right))}px out of its frame`);
          if (part.scrollWidth > part.clientWidth + 1) out.push(`${frame.dataset.testid}: a footer's content is wider than it`);
        }
      }
      const doc = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      if (doc > 0) out.push(`the page scrolls sideways by ${doc}px`);
      return { out, frames: frames.length, footers: document.querySelectorAll("[data-table-bulk], [data-table-pagination]").length };
    });
    if (narrow.footers < 4) problems.push(`harness: at 375 only ${narrow.footers} footers found`);
    for (const s of narrow.out) problems.push(`375/coarse: ${s}`);

    for (const e of errors) problems.push(e);
  } finally {
    stopErrors();
    await page.emulateMedia({ forcedColors: "none" });
  }

  if (problems.length) throw new Error(`data-datatable FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `data-datatable OK (${JSON.stringify(summary)})`;
}
