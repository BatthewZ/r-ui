// @covers   charts/LineChart, charts/BarChart, charts/Heatmap
// @sections charts-linechart charts-barchart charts-heatmap charts-hostiledata
// @tier     component
//
// Browser check: the charts read, respond and stay accessible on every axis.
//
// Run it through `bun run browser:check charts`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print charts-interaction)"
//
// Asserts, on the charts sections opened alone:
//   1. harness: a vertical chart's plot is exactly the root's --CHART-H-COMFORTABLE at
//      comfortable, and the compact demo's is --CHART-H-COMPACT (shorter);
//   2. the default theme and the first dark theme the showcase lists × comfortable /
//      compact × fine / coarse at 1280 and 375 (a fresh load per width and for the
//      combinations `viewMatrix` rotates in, a live switch for the rest): no console
//      or page error, no tripped
//      section; every line chart's plot is exactly the --CHART-H it sits under (so
//      compact boxes and coarse input included); every axis label in every chart is
//      at least 10px, inside its chart's width, and never overlaps its neighbour (x labels
//      side by side, y labels stacked, heatmap hour labels); no chart section scrolls
//      sideways;
//   3. hover: the crosshair snaps to the nearest x (within half a step of the pointer),
//      the tooltip is open in the top layer and lists every series at that x with the
//      same values as the table's row, and a passing pointer announces nothing;
//   4. the first chart's visually hidden table is in the accessibility tree by the
//      chart's name, and "Show as table" draws it, visibly, in place of the plot.
// Keys, the tap, table captions and hostile data (notes, the undrawable chart's table)
// are charts.test.tsx's.
async (page) => {
  const problems = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  // Every charts section: the label, table and scroll claims cover them all.
  const SECTIONS = ["charts-linechart", "charts-barchart", "charts-heatmap", "charts-hostiledata"];
  const load = async (width, view) => {
    await openSection(page, SECTIONS, { width, view });
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

    // 4: the table, for a screen reader and on request.
    const tableAria = await page.getByRole("table", { name: "Requests per second by region, last 7 days" }).count();
    if (tableAria !== 1) problems.push(`the first chart's table is not in the accessibility tree (${tableAria})`);
    await page.locator("#charts-linechart figure[data-chart]").first().getByRole("button", { name: "Show as table" }).click();
    const shown = await page.evaluate(() => {
      const f = document.querySelector("#charts-linechart figure[data-chart]");
      const t = f.querySelector("[data-chart-table]");
      return { state: t.getAttribute("data-chart-table"), height: t.getBoundingClientRect().height, plot: !!f.querySelector("[data-chart-plot]") };
    });
    if (shown.state !== "visible" || shown.height < 40 || shown.plot) problems.push(`Show as table: ${JSON.stringify(shown)}`);
    for (const e of errors) problems.push(`interactions: ${e}`);

    // 2: the matrix: a fresh load per width and for the combinations `viewMatrix`
    // rotates in, a live switch for the rest.
    const dark = await darkTheme(page);
    const sweep = await sweepViews(
      page,
      { themes: ["default", dark], widths: [1280, 375] },
      {
        load: async ({ width, ...view }) => {
          errors.length = 0;
          await load(width, view);
        },
        check: async (view, label) => {
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
          errors.length = 0;
        },
      },
    );
    combos = sweep.combos;
    summary.fresh = sweep.fresh.length;
    if (labelCount < combos * 50) problems.push(`harness: measured only ${labelCount} axis labels over ${combos} combinations`);
  } finally {
    stopErrors();
  }

  if (problems.length) throw new Error(`charts-interaction FAILED (${problems.length}):\n  ${problems.slice(0, 40).join("\n  ")}`);
  return `charts-interaction OK (plot ${summary.heights.first}px = --CHART-H, compact ${summary.heights.compactPlot}px; hover snaps and matches the table; the table reachable and shown on request; ${plotCount} plots at their --CHART-H and ${labelCount} axis labels clear of each other over ${combos} combinations, ${summary.fresh} loaded fresh)`;
}
