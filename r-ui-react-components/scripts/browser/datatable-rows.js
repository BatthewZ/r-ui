// Browser check: DataTable's row features, with real keys, focus and layout.
//
// Run it through `bun run browser:check datatable-rows`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print datatable-rows)"
//
// Asserts, on the Overview's "DataTable features" demos (`[data-testid^="dt-"]`):
//   1. expand by keyboard: Tab from the head's first sort button reaches the first row's
//      disclosure button; Enter opens a detail row directly under its row (named by the
//      button's aria-controls), one cell spanning every column and as wide as the table, with
//      a leading marker drawn; focus stays on the button; Space closes it;
//   2. bulk bar: three row checkboxes pressed → a "Selected rows" group shows "3 selected", the
//      status says it, the bar lies inside the table's frame; with 25 rows to a page in the
//      bounded all-features table, the bar sticks to the frame's bottom edge (in the sticky
//      layer) while rows scroll under it; "Clear selection" by Enter removes it, unchecks every
//      row and puts focus on select-all;
//   3. filters: the filtered demo starts on Healthy only (every row says so); Clear filters
//      shows all 16; typing "checkout" in the name filter leaves exactly that row;
//   4. pages: the pager is laid out after the range text, inside the frame; five rows and
//      "1–5 of 48" with ten pages; choosing 10 rows per page shows ten rows, "1–10 of 48"
//      and five pages; Next page shows "11–20 of 48" and other rows;
//   5. at 375 and coarse input, the pager and the bulk bar stay inside their frame and the
//      page does not scroll sideways.
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
  const bodyRowCount = (id) => demo(id).locator("tbody > tr[data-table-row]").count();

  try {
    await load({ theme: "default", density: "comfortable", input: "fine" });

    // 1. Expand by keyboard.
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

    // 2. Bulk bar: three rows, inside the frame, then cleared by keyboard.
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

    // 2b. Sticky to the frame's bottom while rows scroll under it.
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

    // 3. Filters narrow rows.
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

    // 4. Pages.
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

    // 5. Narrow and coarse: the footers stay inside their frames.
    await load({ theme: "default", density: "comfortable", input: "coarse" }, 375);
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
  }

  if (problems.length) throw new Error(`datatable-rows FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `datatable-rows OK (${JSON.stringify(summary)})`;
}
