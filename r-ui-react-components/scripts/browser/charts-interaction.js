// Browser check: the charts read, respond and stay accessible on every axis.
//
// Run it through `bun run browser:check charts`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print charts-interaction)"
//
// Asserts, on the Overview's charts sections:
//   1. harness: a vertical chart's plot is exactly the root's --CHART-H-COMFORTABLE at
//      comfortable, and the compact demo's is --CHART-H-COMPACT (shorter);
//   2. the default theme and the first dark theme the showcase lists × comfortable /
//      compact × fine / coarse at 1280 and 375: no console or page error, no tripped
//      section; every line chart's plot is exactly the --CHART-H it sits under (so
//      compact boxes and coarse input included); every axis label in every chart is
//      at least 10px, inside its chart's box, and never overlaps its neighbour (x labels
//      side by side, y labels stacked, heatmap hour labels); no chart section scrolls
//      sideways;
//   3. hover: the crosshair snaps to the nearest x (within half a step of the pointer),
//      the tooltip is open in the top layer and lists every series at that x with the
//      same values as the table's row;
//   4. keyboard: Home / ArrowRight / End move the crosshair, and the polite status
//      announces the row's label and every series' value, as the table has them;
//   5. touch: a tap (pointerType touch) inspects and announces; a press elsewhere clears;
//   6. every chart has a table in the accessibility tree named like the chart; "Show as
//      table" shows it visibly in place of the plot; the hostile-data section rendered
//      its notes (8 of 11 series drawn) and its undrawable chart as a visible table.
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const problems = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (width, view) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/charts-linechart`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [KEY, view]);
    await page.reload();
    await waitForShowcase(page);
    await page.locator("#charts-linechart [data-chart-plot]").first().waitFor();
    // Charts redraw once their box is measured; let the observers settle.
    await page.waitForTimeout(400);
  };

  /** Every chart's labels, measured as painted. */
  const measureLabels = () =>
    page.evaluate(() => {
      const out = [];
      const sections = [...document.querySelectorAll('[id^="charts-"]')];
      for (const section of sections) {
        const scroll = section.scrollWidth - section.clientWidth;
        if (scroll > 0) out.push({ problem: `${section.id} scrolls sideways by ${scroll}px` });
        for (const figure of section.querySelectorAll("figure[data-chart]")) {
          const name = figure.getAttribute("aria-label");
          const box = figure.getBoundingClientRect();
          const groups = [...figure.querySelectorAll("[data-axis]")];
          for (const group of groups) {
            const els = [...group.querySelectorAll("text, span")].filter((e) => e.textContent);
            const rects = els.map((e) => ({ r: e.getBoundingClientRect(), t: e.textContent, size: Number.parseFloat(getComputedStyle(e).fontSize) }));
            for (const { r, t, size } of rects) {
              if (size < 10) out.push({ problem: `${name}: label "${t}" is ${size}px` });
              if (r.left < box.left - 0.5 || r.right > box.right + 0.5) {
                out.push({ problem: `${name}: label "${t}" spills its chart (${Math.round(r.left)}–${Math.round(r.right)} vs ${Math.round(box.left)}–${Math.round(box.right)})` });
              }
            }
            // Side by side when they share a line; stacked otherwise.
            const sorted = [...rects].sort((a, b) => a.r.left - b.r.left || a.r.top - b.r.top);
            for (let i = 1; i < sorted.length; i += 1) {
              const a = sorted[i - 1].r;
              const b = sorted[i].r;
              const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
              const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
              if (overlapX > 0.5 && overlapY > 0.5) out.push({ problem: `${name}: labels "${sorted[i - 1].t}" and "${sorted[i].t}" overlap` });
            }
            out.push({ count: rects.length });
          }
        }
      }
      return out;
    });

  const state = () =>
    page.evaluate(() => {
      const figure = document.querySelector("#charts-linechart figure[data-chart]");
      const plot = figure.querySelector("[data-chart-plot]");
      const cross = figure.querySelector("[data-chart-crosshair]");
      const line = cross?.querySelector("line");
      const tip = figure.querySelector("[data-chart-tooltip]");
      const rows = [...figure.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent));
      const pr = plot.getBoundingClientRect();
      return {
        row: cross ? Number(cross.getAttribute("data-row")) : null,
        cx: line ? pr.left + Number(line.getAttribute("x1")) : null,
        tipOpen: !!tip && tip.matches(":popover-open"),
        tipRows: tip ? [...tip.querySelectorAll("[data-chart-tooltip-row]")].map((r) => r.children[1]?.textContent) : [],
        legend: figure.querySelectorAll("[data-chart-legend] li").length,
        table: rows,
        status: figure.querySelector('[role="status"]').textContent,
        plot: { left: pr.left, top: pr.top, width: pr.width, height: pr.height },
      };
    });

  let combos = 0;
  let labelCount = 0;
  let plotCount = 0;
  const summary = {};
  try {
    // 1: the harness, at comfortable + fine.
    await load(1280, { theme: "default", density: "comfortable", input: "fine" });
    const heights = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const rem = (n) => Number.parseFloat(css.getPropertyValue(n)) * Number.parseFloat(css.fontSize);
      const plots = [...document.querySelectorAll("#charts-linechart [data-chart-plot]")];
      return {
        comfortable: rem("--CHART-H-COMFORTABLE"),
        compact: rem("--CHART-H-COMPACT"),
        first: plots[0].getBoundingClientRect().height,
        compactPlot: document.querySelector('#charts-linechart [data-density="compact"] [data-chart-plot]').getBoundingClientRect().height,
      };
    });
    summary.heights = heights;
    if (!(heights.comfortable > 0) || Math.abs(heights.first - heights.comfortable) > 0.5) {
      problems.push(`harness: the plot is ${heights.first}px, --CHART-H-COMFORTABLE is ${heights.comfortable}px`);
    }
    if (Math.abs(heights.compactPlot - heights.compact) > 0.5 || !(heights.compact < heights.comfortable)) {
      problems.push(`harness: the compact plot is ${heights.compactPlot}px, --CHART-H-COMPACT is ${heights.compact}px`);
    }

    // 3: hover snaps and lists every series, as the table has it.
    const plot = page.locator("#charts-linechart [data-chart-plot]").first();
    await plot.scrollIntoViewIfNeeded();
    const s0 = await state();
    const step = s0.plot.width / Math.max(1, s0.table.length - 1);
    for (const f of [0.2, 0.5, 0.83]) {
      const px = s0.plot.left + s0.plot.width * f;
      await page.mouse.move(px, s0.plot.top + s0.plot.height / 2);
      await page.waitForTimeout(120);
      const s = await state();
      if (s.row === null) {
        problems.push(`hover at ${f}: no crosshair`);
        continue;
      }
      if (Math.abs(s.cx - px) > step / 2 + 1) problems.push(`hover at ${f}: crosshair ${s.cx}px is not the nearest x to ${px}px (step ${step}px)`);
      if (!s.tipOpen) problems.push(`hover at ${f}: the tooltip is not open in the top layer`);
      if (s.tipRows.length !== s.legend || s.legend < 2) problems.push(`hover at ${f}: tooltip lists ${s.tipRows.length} of ${s.legend} series`);
      const tableRow = s.table[s.row]?.slice(1) ?? [];
      if (JSON.stringify(s.tipRows) !== JSON.stringify(tableRow)) {
        problems.push(`hover at ${f}: tooltip ${JSON.stringify(s.tipRows)} differs from the table's row ${JSON.stringify(tableRow)}`);
      }
      if (s.status !== "") problems.push(`hover at ${f}: a passing pointer was announced ("${s.status}")`);
    }
    await page.mouse.move(2, 2);
    await page.waitForTimeout(150);
    if ((await state()).row !== null) problems.push("pointer left: the crosshair stays");

    // 4: keyboard, announced as the table has it.
    await plot.focus();
    const keys = [
      ["Home", 0],
      ["ArrowRight", 1],
      ["End", s0.table.length - 1],
      ["ArrowLeft", s0.table.length - 2],
    ];
    for (const [key, want] of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(80);
      const s = await state();
      if (s.row !== want) problems.push(`${key}: crosshair on row ${s.row}, expected ${want}`);
      const row = s.table[want] ?? [];
      const names = await page.evaluate(() =>
        [...document.querySelector("#charts-linechart figure[data-chart]").querySelectorAll("thead th")].slice(1).map((th) => th.textContent),
      );
      const expected = `${row[0]}: ${names.map((n, i) => `${n} ${row[i + 1]}`).join(", ")}`;
      if (s.status !== expected) problems.push(`${key}: announced "${s.status}", expected "${expected}"`);
      if (s.tipRows.length !== s.legend) problems.push(`${key}: tooltip lists ${s.tipRows.length} of ${s.legend} series`);
    }
    await page.keyboard.press("Escape");
    if ((await state()).row !== null) problems.push("Escape: the crosshair stays");

    // 5: a tap inspects and announces; a press elsewhere clears.
    const tapped = await page.evaluate(() => {
      const el = document.querySelector("#charts-linechart [data-chart-plot]");
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", clientX: r.left + r.width * 0.5, clientY: r.top + 20 }));
      return true;
    });
    await page.waitForTimeout(100);
    const afterTap = await state();
    if (!tapped || afterTap.row === null || !afterTap.status.includes(":")) problems.push(`tap: nothing inspected or announced ("${afterTap.status}")`);
    await page.evaluate(() => document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
    await page.waitForTimeout(100);
    if ((await state()).row !== null) problems.push("tap: a press elsewhere did not clear the inspection");

    // 6: the table, for a screen reader and on request.
    const figures = await page.locator('[id^="charts-"] figure[data-chart]').count();
    const named = await page.evaluate(() =>
      [...document.querySelectorAll('[id^="charts-"] figure[data-chart]')].filter((f) => {
        const name = f.getAttribute("aria-label");
        const table = f.querySelector("table");
        return table && table.querySelector("caption")?.textContent === name;
      }).length,
    );
    const empty = await page.locator('[id^="charts-"] [data-chart-empty]').count();
    if (figures < 10 || named + empty !== figures) problems.push(`${named} of ${figures} charts carry a table named like the chart (${empty} empty)`);
    const tableAria = await page.getByRole("table", { name: "Requests per second by region, last 7 days" }).count();
    if (tableAria !== 1) problems.push(`the first chart's table is not in the accessibility tree (${tableAria})`);
    await page.locator("#charts-linechart figure[data-chart]").first().getByRole("button", { name: "Show as table" }).click();
    const shown = await page.evaluate(() => {
      const f = document.querySelector("#charts-linechart figure[data-chart]");
      const t = f.querySelector("[data-chart-table]");
      return { state: t.getAttribute("data-chart-table"), height: t.getBoundingClientRect().height, plot: !!f.querySelector("[data-chart-plot]") };
    });
    if (shown.state !== "visible" || shown.height < 40 || shown.plot) problems.push(`Show as table: ${JSON.stringify(shown)}`);
    const hostile = await page.evaluate(() => {
      const s = document.querySelector("#charts-hostiledata");
      return {
        note: !!s && [...s.querySelectorAll("[data-chart-note]")].some((n) => n.textContent.includes("8 of 11 series drawn")),
        tables: s ? s.querySelectorAll('[data-chart-table="visible"]').length : 0,
        empty: s ? s.querySelectorAll("[data-chart-empty]").length : 0,
      };
    });
    if (!hostile.note || hostile.tables < 2 || hostile.empty < 1) problems.push(`hostile data: ${JSON.stringify(hostile)}`);
    for (const e of errors) problems.push(`interactions: ${e}`);

    // 2: the matrix.
    const dark = await darkTheme(page);
    for (const width of [1280, 375]) {
      for (const theme of ["default", dark]) {
        for (const density of ["comfortable", "compact"]) {
          for (const input of ["fine", "coarse"]) {
            const label = `${theme}/${density}/${input}@${width}`;
            errors.length = 0;
            await load(width, { theme, density, input });
            combos++;
            const tripped = await page.locator('[id^="charts-"] [data-section-error]').count();
            if (tripped) problems.push(`${label}: ${tripped} charts section(s) tripped`);
            for (const m of await measureLabels()) {
              if (m.problem) problems.push(`${label}: ${m.problem}`);
              else labelCount += m.count;
            }
            const plots = await page.evaluate(() =>
              [...document.querySelectorAll("#charts-linechart [data-chart-plot]")].map((plot) => {
                // --CHART-H as resolved where this plot sits (its own density boundary).
                const probe = document.createElement("div");
                probe.style.cssText = "position:absolute;visibility:hidden;block-size:var(--CHART-H)";
                plot.append(probe);
                const want = probe.getBoundingClientRect().height;
                probe.remove();
                return { name: plot.closest("figure")?.getAttribute("aria-label"), height: plot.getBoundingClientRect().height, want };
              }),
            );
            if (plots.length < 5) problems.push(`${label}: ${plots.length} line-chart plots measured, the section draws 5`);
            for (const p of plots) {
              if (!(p.want > 0) || Math.abs(p.height - p.want) > 0.5) problems.push(`${label}: "${p.name}" plot is ${p.height}px, its --CHART-H is ${p.want}px`);
            }
            plotCount += plots.length;
            for (const e of errors) problems.push(`${label}: ${e}`);
          }
        }
      }
    }
    if (labelCount < combos * 50) problems.push(`harness: measured only ${labelCount} axis labels over ${combos} combinations`);
  } finally {
    stopErrors();
    await page.evaluate((key) => localStorage.removeItem(key), KEY);
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  if (problems.length) throw new Error(`charts-interaction FAILED (${problems.length}):\n  ${problems.slice(0, 40).join("\n  ")}`);
  return `charts-interaction OK (plot ${summary.heights.first}px = --CHART-H, compact ${summary.heights.compactPlot}px; hover snaps and matches the table; keys and tap announce; ${plotCount} plots at their --CHART-H and ${labelCount} axis labels clear of each other over ${combos} combinations)`;
}
