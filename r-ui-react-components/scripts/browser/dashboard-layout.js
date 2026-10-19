// @covers   navigation/AppShell, data/DataTable, data/Timeline, data/Sparkline, charts, filters/FilterBar, toolbar/Toolbar, feedback/Banner, feedback/ProgressRing, overlays/ToastProvider
// @tier     page
// @cost     22
//
// Browser check: the Dashboard page is a real dashboard on every axis.
//
// Run it through `bun run browser:check dashboard`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print dashboard-layout)"
//
// Asserts:
//   1. harness: at fine input --HIT-MIN is 24px, so --ROW-H is the density's own
//      named value (`--ROW-H-COMFORTABLE` / `-COMPACT`) and the comparison in 5 means something;
//   2. every theme the showcase lists × comfortable / compact × fine / coarse
//      at 1440 and 375 (a fresh load per width and for the combinations `viewMatrix`
//      rotates in, a live switch for the rest): no console or page error, no horizontal scroll in the document
//      or in the dashboard's own scroll frame; at 375 the SHOWCASE's bottom nav stays
//      reachable below the frame (the frame takes no press at any link's centre);
//   3. at 1440 the AppShell sidebar is the FULL sidebar (brand name shown, wider
//      than a rail) and the six KPI tiles sit in one row;
//   4. at 900 the sidebar is the icon RAIL (brand name visually hidden, rail-wide)
//      and there is no bottom nav; the full sidebar's column is exactly --COLUMN-MD wide; at 375 the BOTTOM NAV shows and the sidebar does not;
//      at 1440 the frame covers the showcase's own sidebar;
//   5. at comfortable + fine: every services row is exactly its --ROW-H with its row
//      actions button inside it, every row
//      in the compact card (`data-density="compact"`) is exactly ITS --ROW-H, and
//      that is shorter than the page's;
//   6. the FilterBar's search for nothing shows the table's EmptyState and puts the
//      search in the hash; "Clear filters" brings the rows back and empties the anchor;
//      the header toolbar's Refresh now raises a toast once the refresh is back;
//   7. the charts are real: Traffic is a LineChart with value and time axes (3+ labels
//      each) and a legend of four regions, and hovering it opens one tooltip listing
//      all four; Error responses is a stacked BarChart with a bar per class per
//      interval; the 5xx card is a 7 × 24 Heatmap with a table, and no "Not in this
//      release" stand-in is left. In the matrix the charts draw (169 marks or more: the
//      heatmap's 168 cells and the others' lines and bars);
//   8. Open incidents is a Timeline: one ordered list of the four incidents, each with
//      a focusable `<time datetime>`, a glyph in its mark and a status word; Tab onto a
//      <time> shows its full reading (year included) in the Tooltip that describes it;
//   9. the FilterBar (a `search` landmark) lays its five controls inline at 1440 and
//      drives the page: pressing Status "Critical" leaves only critical rows, the
//      result count says how many, the hash carries it and a reload opens on it; a
//      region in the hash narrows Traffic to that one series; Clear all leaves every
//      region and all retained time (an empty `time=`);
//  10. the header is a named toolbar: at 1440 every unit is in the bar and "More" is not
//      shown; at 375 the four actions have moved into "More", which sits inside the
//      header and lists them; at coarse input no two of its drawn controls' hit areas
//      overlap (every combination);
//  11. the services DataTable's features: resize handles on the headers, the Service
//      column pinned (sticky), the columns menu lists the hidden "Last deploy"
//      unchecked and toggles it, a row's details open a detail row whose rollout is a
//      segmented progressbar (3 of 5) without changing the row's height, selecting two
//      rows shows the bulk bar ("2 selected") whose Export runs a progress bar to an
//      "Export ready" toast, Clear selection removes it, and pages read "1–10 of 14" then
//      "11–14 of 14"; hovering a team opens its HoverCard (who is on call), and Escape with
//      the pointer moved away leaves it closed;
//  12. the compact deploys card's rollout is a ProgressRing (31 of 50 hosts);
//  13. the maintenance Banner is a region named by its title; Dismiss hides it, hands
//      focus to the page heading, and it stays dismissed across a reload;
//  14. in every combination no card's ErrorBoundary has tripped (`data-dashboard-error`),
//      and at 375 (comfortable, fine) the FilterBar is folded into its Filters button.
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const BANNER_KEY = "kestrel:maintenance:2026-10-17";
  const problems = [];
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async (width, view) => {
    await openPage(page, "dashboard", { view, width });
    await page.locator("[data-dashboard-kpis]").waitFor();
  };

  const shell = () =>
    page.evaluate(() => {
      const box = (el) => (el ? el.getBoundingClientRect() : null);
      const shown = (el) => !!el && getComputedStyle(el).display !== "none" && box(el).width > 0;
      // Scoped to the dashboard's own shell: the showcase around it is an AppShell too.
      const frame = document.querySelector("[data-dashboard-frame]");
      const sidebar = frame?.querySelector(".r-navigation-shell-sidebar");
      const brandName = frame?.querySelector(".r-navigation-shell-sidebar .r-navigation-shell-brand-name");
      const css = getComputedStyle(document.documentElement);
      const kpiTops = [...document.querySelectorAll("[data-dashboard-kpis] > *")].map((k) => Math.round(box(k).top));
      /** `var(--NAME)` as px, resolved inside `el` (density follows where it is read). */
      const tokenPx = (el, name) => {
        const probe = document.createElement("div");
        probe.style.cssText = `position: absolute; visibility: hidden; block-size: var(${name}); inline-size: var(${name})`;
        el.append(probe);
        const px = probe.getBoundingClientRect().height;
        probe.remove();
        return px;
      };
      const sparks = [...(frame?.querySelectorAll("[data-dashboard-kpis] svg[role=img][preserveAspectRatio=none]") ?? [])].map((svg) => ({
        height: box(svg).height,
        token: tokenPx(svg.parentElement, "--SPARK-H"),
      }));
      const toolbar = frame?.querySelector("[data-dashboard-actions]");
      const units = [...(toolbar?.querySelectorAll(":scope > [data-toolbar-unit]") ?? [])];
      const more = toolbar?.querySelector(":scope > [data-toolbar-more]");
      const header = frame?.querySelector(".r-navigation-shell-header");
      // Coarse spacing: the drawn controls' hit areas (at least --HIT-MIN wide, centred) never overlap.
      const hit = toolbar ? tokenPx(toolbar, "--HIT-MIN") : 0;
      const controls = toolbar
        ? [...toolbar.querySelectorAll("button")].filter((b) => !b.closest("[data-overflowed]") && b.getClientRects().length > 0).map(box)
        : [];
      controls.sort((a, b) => a.left - b.left);
      const reach = (r) => Math.max(r.width, hit) / 2;
      const overlaps = controls
        .slice(1)
        .map((r, i) => {
          const prev = controls[i];
          const prevEnd = prev.left + prev.width / 2 + reach(prev);
          const start = r.left + r.width / 2 - reach(r);
          return prevEnd - start;
        })
        .filter((d) => d > 0.5).length;
      const filterTrigger = frame?.querySelector("[data-dashboard-filters] [data-filter-trigger]");
      return {
        toolbar: {
          role: toolbar?.getAttribute("role") ?? null,
          name: toolbar?.getAttribute("aria-label") ?? null,
          units: units.length,
          overflowed: units.filter((u) => u.hasAttribute("data-overflowed")).length,
          more: !!more && !more.hasAttribute("data-overflowed"),
          moreInHeader: (() => {
            const button = more?.querySelector("button");
            if (!button || !header) return false;
            const m = box(button);
            const h = box(header);
            return m.width > 0 && m.left >= h.left - 0.5 && m.right <= h.right + 0.5 && m.right <= innerWidth + 0.5;
          })(),
          controls: controls.length,
          overlaps,
        },
        filtersFolded: !!filterTrigger && filterTrigger.getClientRects().length > 0 && filterTrigger.checkVisibility(),
        boundaryErrors: frame ? frame.querySelectorAll("[data-dashboard-error]").length : -1,
        sidebar: shown(sidebar),
        sidebarW: sidebar ? box(sidebar).width : 0,
        innerW: sidebar?.querySelector(".r-navigation-shell-sidebar-inner") ? box(sidebar.querySelector(".r-navigation-shell-sidebar-inner")).width : 0,
        columnMd: sidebar ? tokenPx(sidebar, "--COLUMN-MD") : 0,
        sparks,
        brandW: brandName ? box(brandName).width : 0,
        bottom: shown(frame?.querySelector(".r-navigation-shell-bottomnav")),
        control: Number.parseFloat(css.getPropertyValue("--CONTROL-H")),
        kpis: kpiTops.length,
        kpiRows: new Set(kpiTops).size,
        docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        frameScroll: frame ? frame.scrollWidth - frame.clientWidth : Number.NaN,
        // The showcase's own navigation, outside the frame.
        hostNav: (() => {
          const nav = document.querySelector("[data-showcase-bottomnav]");
          if (!shown(nav) || !frame) return null;
          const links = [...nav.querySelectorAll("a")];
          // Covered by the frame, specifically: a toast raised earlier may sit over the nav.
          const hit = links.filter((a) => {
            const r = box(a);
            const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!el && !frame.contains(el);
          });
          return { links: links.length, hit: hit.length, gap: Math.round(box(nav).top - box(frame).bottom) };
        })(),
        hostSidebarCovered: (() => {
          const side = [...document.querySelectorAll(".r-navigation-shell-sidebar")].find((el) => !frame?.contains(el));
          if (!shown(side)) return null;
          const r = box(side);
          return !!frame?.contains(document.elementFromPoint(r.left + r.width / 2, innerHeight / 2));
        })(),
      };
    });

  let combos = 0;
  const summary = { page: Number.NaN, card: Number.NaN, charts: "", incidents: 0 };
  try {
    // 1 + 5: row heights, at comfortable + fine where compact must differ.
    await load(1440, { theme: "default", density: "comfortable", input: "fine" });
    const rows = await page.evaluate(() => {
      const rootCss = getComputedStyle(document.documentElement);
      // Unregistered tokens compute to their declared text (rem); registered ones to px.
      const named = (n) => {
        const v = rootCss.getPropertyValue(n).trim();
        if (v.endsWith("rem")) return Number.parseFloat(v) * Number.parseFloat(rootCss.fontSize);
        return v.endsWith("px") ? Number.parseFloat(v) : Number.NaN;
      };
      const measure = (scope) =>
        [...document.querySelectorAll(`${scope} tbody tr[data-table-row]`)].map((tr) => ({
          h: tr.getBoundingClientRect().height,
          rowH: Number.parseFloat(getComputedStyle(tr).getPropertyValue("--ROW-H")),
          // The row's actions menu button, the tallest thing a services row holds.
          actions: tr.querySelector("button[aria-haspopup='menu']")?.getBoundingClientRect().height ?? null,
        }));
      return {
        hit: named("--HIT-MIN"),
        comfortable: named("--ROW-H-COMFORTABLE"),
        compact: named("--ROW-H-COMPACT"),
        page: measure("[data-dashboard-services]"),
        card: measure("[data-dashboard-compact]"),
      };
    });
    if (rows.hit !== 24) problems.push(`harness: fine --HIT-MIN ${rows.hit}px, source predicts 24px`);
    if (!(rows.compact < rows.comfortable)) {
      problems.push(`harness: --ROW-H-COMPACT ${rows.compact}px is not below --ROW-H-COMFORTABLE ${rows.comfortable}px`);
    }
    if (rows.page.length !== 10) problems.push(`services table rendered ${rows.page.length} rows, expected a page of 10`);
    if (rows.card.length < 3) problems.push(`compact card rendered ${rows.card.length} rows`);
    const pageRowH = Math.max(rows.comfortable, rows.hit);
    const cardRowH = Math.max(rows.compact, rows.hit);
    for (const [name, list, want] of [
      ["services", rows.page, pageRowH],
      ["compact card", rows.card, cardRowH],
    ]) {
      list.forEach((r, i) => {
        if (Math.abs(r.rowH - want) > 0.5) problems.push(`${name} row ${i}: --ROW-H ${r.rowH}px, expected ${want}px`);
        if (Math.abs(r.h - r.rowH) > 0.5) problems.push(`${name} row ${i}: ${r.h}px tall, --ROW-H is ${r.rowH}px`);
      });
    }
    // The row height holds WITH the actions column: every services row has its button, inside the row.
    rows.page.forEach((r, i) => {
      if (r.actions === null || r.actions > r.rowH + 0.5) problems.push(`services row ${i}: actions button ${r.actions}px in a ${r.rowH}px row`);
    });
    const cardH = rows.card[0]?.h ?? Number.NaN;
    const pageH = rows.page[0]?.h ?? Number.NaN;
    summary.page = pageH;
    summary.card = cardH;
    if (!(cardH < pageH)) problems.push(`compact card rows (${cardH}px) are not shorter than the page's (${pageH}px)`);

    // 6: the FilterBar's search narrows the table to nothing: the EmptyState, the hash, and the way out.
    const services = page.locator("[data-dashboard-services]");
    const bar = page.getByRole("search", { name: "Filters" });
    await bar.getByRole("searchbox", { name: "Search services" }).fill("zzz-no-such-service");
    const empty = services.getByText("No services match");
    if (!(await empty.isVisible())) problems.push("filtering the services table to nothing shows no EmptyState");
    const searchHash = await page.evaluate(() => location.hash);
    if (!decodeURIComponent(searchHash).includes("q=zzz-no-such-service")) problems.push(`the search is not in the URL (${searchHash})`);
    await services.getByRole("button", { name: "Clear filters" }).click();
    const restored = await services.locator("tbody tr[data-table-row]").count();
    if (restored !== rows.page.length) problems.push(`"Clear filters" restored ${restored} rows, expected ${rows.page.length}`);
    const clearedHash = await page.evaluate(() => location.hash);
    if (clearedHash !== "#/dashboard") problems.push(`back on the default view the hash is ${clearedHash}, expected #/dashboard`);

    const actions = page.getByRole("toolbar", { name: "Dashboard actions" });
    await actions.getByRole("button", { name: "Refresh now" }).click();
    const toast = page.getByText("Dashboard refreshed");
    await toast.waitFor({ timeout: 3000 }).catch(() => problems.push("the Refresh now action raised no toast"));

    // 7: real charts.
    const traffic = page.locator("[data-dashboard-traffic]");
    await traffic.scrollIntoViewIfNeeded();
    const line = await page.evaluate(() => {
      const fig = document.querySelector('[data-dashboard-traffic] figure[data-chart="line"]');
      return {
        x: fig ? fig.querySelectorAll('[data-axis="category"] text').length : 0,
        y: fig ? fig.querySelectorAll('[data-axis="value"] text').length : 0,
        legend: fig ? fig.querySelectorAll("[data-chart-legend] li").length : 0,
      };
    });
    if (line.x < 3 || line.y < 3 || line.legend !== 4) problems.push(`Traffic line chart: ${JSON.stringify(line)}, expected 3+ x and y labels and 4 regions`);
    const plotBox = await traffic.locator('figure[data-chart="line"] [data-chart-plot]').boundingBox();
    if (plotBox) {
      await page.mouse.move(plotBox.x + plotBox.width * 0.6, plotBox.y + plotBox.height / 2);
      await page.waitForTimeout(150);
    }
    const tipRows = await traffic.locator("[data-chart-tooltip] [data-chart-tooltip-row]").count();
    if (tipRows !== 4) problems.push(`Traffic hover: the tooltip lists ${tipRows} series, expected 4`);
    await page.mouse.move(2, 2);
    await traffic.getByRole("tab", { name: "Error responses" }).click();
    await page.waitForTimeout(250);
    const bars = await page.evaluate(() => {
      const fig = document.querySelector('[data-dashboard-traffic] figure[data-chart="bar"]');
      return { bars: fig ? fig.querySelectorAll("path.r-charts-bar").length : 0, rows: fig ? fig.querySelectorAll("tbody tr").length : 0 };
    });
    if (!(bars.rows >= 24) || bars.bars < bars.rows * 3 * 0.9) problems.push(`Error responses: ${bars.bars} bars for ${bars.rows} intervals × 3 classes`);
    const heat = await page.evaluate(() => {
      const card = document.querySelector("[data-dashboard-heatmap]");
      return {
        cells: card ? card.querySelectorAll("[data-cell][data-step]").length : 0,
        table: card ? card.querySelectorAll("tbody tr").length : 0,
        standIn: document.body.textContent.includes("Not in this release"),
      };
    });
    if (heat.cells !== 168 || heat.table !== 7 || heat.standIn) problems.push(`5xx heatmap: ${JSON.stringify(heat)}, expected 168 painted cells, a 7-row table and no stand-in`);
    summary.charts = `${line.x}+${line.y} axis labels, ${bars.bars} bars, ${heat.cells} heat cells`;

    // 8: the incidents card is a Timeline.
    const incidents = await page.evaluate(() => {
      const card = document.querySelector("[data-dashboard-incidents]");
      const lists = card ? [...card.querySelectorAll("ol")] : [];
      const items = lists.flatMap((ol) => [...ol.querySelectorAll(":scope > li")]);
      return {
        lists: lists.length,
        named: lists.every((ol) => ol.getAttribute("aria-label") || ol.getAttribute("aria-labelledby")),
        items: items.length,
        complete: items.filter(
          (li) =>
            /^\d{4}-\d{2}-\d{2}T/.test(li.querySelector("time")?.getAttribute("datetime") ?? "") &&
            li.querySelector("time")?.tabIndex === 0 &&
            li.querySelector("[data-timeline-mark] svg") &&
            (li.querySelector("[data-timeline-status]")?.textContent.trim() ?? "") !== "",
        ).length,
      };
    });
    if (incidents.lists !== 1 || !incidents.named || incidents.items !== 4 || incidents.complete !== 4) {
      problems.push(`Open incidents: ${JSON.stringify(incidents)}, expected one named list of 4 events, each with a datetime, a glyph and a status word`);
    }
    summary.incidents = incidents.complete;
    // The full reading is reachable by keyboard: Tab onto an incident's <time> opens the
    // Tooltip that describes it, and it names the year the short reading leaves out.
    const incidentTime = page.locator("[data-dashboard-incidents] li time").first();
    await incidentTime.scrollIntoViewIfNeeded();
    await incidentTime.evaluate((el) => {
      const before = document.createElement("button");
      before.dataset.probe = "";
      el.closest("li").prepend(before);
      before.focus();
    });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(250);
    const reading = await incidentTime.evaluate((el) => {
      document.querySelector("[data-probe]")?.remove();
      const tip = (el.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .map((id) => document.getElementById(id))
        .find((t) => t?.role === "tooltip");
      return {
        focused: document.activeElement === el,
        short: el.textContent.trim(),
        text: tip?.textContent.trim() ?? null,
        shown: Boolean(tip?.matches(":popover-open")),
        year: new Date(el.getAttribute("datetime")).getFullYear(),
      };
    });
    if (!reading.focused || !reading.shown || !reading.text?.includes(String(reading.year)) || reading.text === reading.short) {
      problems.push(`Open incidents: Tab onto a <time> did not show its full reading ${JSON.stringify(reading)}`);
    }
    await page.keyboard.press("Escape");

    // 9: the FilterBar drives the table, the charts and the URL.
    const inline = await page.evaluate(() => {
      const root = document.querySelector("[data-dashboard-filters]");
      const drawn = (el) => !!el && el.getClientRects().length > 0 && el.checkVisibility();
      return {
        landmark: root?.getAttribute("role") ?? null,
        fields: ["time", "region", "status", "p95", "q"].filter((id) => drawn(root?.querySelector(`[data-filter="${id}"]`))),
        trigger: drawn(root?.querySelector("[data-filter-trigger]")),
      };
    });
    if (inline.landmark !== "search" || inline.fields.length !== 5 || inline.trigger) {
      problems.push(`1440: the FilterBar is not inline with its five controls ${JSON.stringify(inline)}`);
    }
    const serviceRows = () =>
      page.evaluate(() => [...document.querySelectorAll("[data-dashboard-services] tbody tr[data-table-row]")].map((tr) => tr.textContent));
    await bar.getByRole("button", { name: "Critical", exact: true }).click();
    await page.waitForTimeout(150);
    const critical = await serviceRows();
    const filtered = await page.evaluate(() => ({
      count: document.querySelector("[data-dashboard-filters] [data-filter-results]")?.textContent ?? "",
      hash: decodeURIComponent(location.hash),
    }));
    if (critical.length < 1 || critical.length >= rows.page.length || critical.some((t) => !t.includes("Critical"))) {
      problems.push(`Status "Critical" left ${critical.length} rows, not all critical`);
    }
    if (!filtered.count.includes(`${critical.length} service`)) problems.push(`the result count reads "${filtered.count}" for ${critical.length} rows`);
    if (!filtered.hash.includes("status=critical")) problems.push(`the status filter is not in the URL (${filtered.hash})`);
    await page.reload();
    await waitForShowcase(page);
    await page.locator("[data-dashboard-kpis]").waitFor();
    await page.waitForTimeout(250);
    const reopened = await serviceRows();
    const chip = await page.evaluate(() => document.querySelector("[data-dashboard-filters] [data-filter-chip='status']")?.textContent ?? "");
    if (!chip.includes("Critical") || reopened.length !== critical.length) {
      problems.push(`a reload did not open on the filtered view (chip "${chip}", ${reopened.length} rows)`);
    }
    const seriesDrawn = () =>
      page.evaluate(() => document.querySelectorAll('[data-dashboard-traffic] figure[data-chart="line"] g[data-series]').length);
    await page.goto(`${base}#/dashboard/${encodeURIComponent("region=eu-west")}`);
    await page.waitForTimeout(250);
    const oneRegion = await seriesDrawn();
    const regionChip = await page.evaluate(() => document.querySelector("[data-dashboard-filters] [data-filter-chip='region']")?.textContent ?? "");
    if (oneRegion !== 1 || !regionChip.includes("eu-west")) problems.push(`a region in the hash drew ${oneRegion} traffic series (chip "${regionChip}"), expected 1`);
    await bar.getByRole("button", { name: "Clear all" }).click();
    await page.waitForTimeout(150);
    const cleared = await page.evaluate(() => ({
      chips: document.querySelectorAll("[data-dashboard-filters] [data-filter-chip]").length,
      hash: decodeURIComponent(location.hash),
    }));
    const allRegions = await seriesDrawn();
    if (cleared.chips !== 0 || allRegions !== 4 || !cleared.hash.endsWith("time=")) {
      problems.push(`Clear all left ${cleared.chips} chips and ${allRegions} series at ${cleared.hash}`);
    }
    await page.goto(`${base}#/dashboard`);
    await page.waitForTimeout(250);

    // 11: the services table's features.
    const table = await page.evaluate(() => {
      const card = document.querySelector("[data-dashboard-services]");
      const nameCell = card?.querySelector("tbody tr[data-table-row] [data-service]")?.closest("td");
      return {
        handles: card ? card.querySelectorAll('thead [role="separator"][aria-label^="Resize "]').length : 0,
        sticky: nameCell ? getComputedStyle(nameCell).position : "",
        pages: card?.querySelector("[data-table-pagination]")?.textContent ?? "",
      };
    });
    if (table.handles < 3) problems.push(`services table: ${table.handles} resize handles`);
    if (table.sticky !== "sticky") problems.push(`services table: the Service column is ${table.sticky}, not pinned`);
    if (!table.pages.includes("1–10 of 14")) problems.push(`services table: pages read "${table.pages}", expected 1–10 of 14`);
    const deployHead = () =>
      page.evaluate(() => [...document.querySelectorAll("[data-dashboard-services] thead th")].some((th) => th.textContent.includes("Last deploy")));
    const hiddenAtFirst = !(await deployHead());
    await services.getByRole("button", { name: "Columns" }).click();
    const deployItem = page.getByRole("menuitemcheckbox", { name: "Last deploy" });
    const before = await deployItem.getAttribute("aria-checked", { timeout: 2000 }).catch(() => null);
    await deployItem.click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(100);
    const shownNow = await deployHead();
    if (!hiddenAtFirst || before !== "false" || !shownNow) {
      problems.push(`columns menu: "Last deploy" hidden at first ${hiddenAtFirst}, listed ${before}, shown after toggling ${shownNow}`);
    }
    if ((await page.locator("[role=menu]:popover-open").count()) > 0) await page.keyboard.press("Escape");

    const searchRow = services.locator("tbody tr[data-table-row]", { has: page.locator("[data-service='search']") });
    const rowH = await searchRow.evaluate((tr) => tr.getBoundingClientRect().height);
    await services.getByRole("button", { name: "Details for search" }).click();
    await page.waitForTimeout(150);
    const detail = await page.evaluate(() => {
      const d = document.querySelector("[data-dashboard-detail='search']");
      const bar = d?.querySelector('[role="progressbar"]');
      return {
        inDetailRow: !!d?.closest("tr[data-table-detail]"),
        now: bar?.getAttribute("aria-valuenow") ?? null,
        max: bar?.getAttribute("aria-valuemax") ?? null,
        segments: bar ? bar.querySelectorAll("[data-segment]").length : 0,
      };
    });
    const rowHOpen = await searchRow.evaluate((tr) => tr.getBoundingClientRect().height);
    if (!detail.inDetailRow || detail.now !== "3" || detail.max !== "5" || detail.segments !== 5) {
      problems.push(`the search row's detail: ${JSON.stringify(detail)}, expected a detail row with a 5-segment rollout at 3`);
    }
    if (Math.abs(rowH - rowHOpen) > 0.5) problems.push(`opening a detail row changed its row from ${rowH}px to ${rowHOpen}px`);
    await services.getByRole("button", { name: "Details for search" }).click();

    await services.getByRole("checkbox", { name: "Select checkout" }).check();
    await services.getByRole("checkbox", { name: "Select search" }).check();
    const bulk = services.locator("[data-table-bulk]");
    const bulkText = (await bulk.textContent({ timeout: 2000 }).catch(() => "")) ?? "";
    if (!bulkText.includes("2 selected") || !bulkText.includes("Export") || !bulkText.includes("Restart")) problems.push(`bulk bar reads "${bulkText}"`);
    await bulk.getByRole("button", { name: "Export" }).click({ timeout: 2000 }).catch(() => problems.push("the bulk bar has no Export"));
    const exporting = await page.evaluate(() => document.querySelector("[data-dashboard-export] [role='progressbar']")?.getAttribute("aria-valuemax") ?? null);
    if (exporting !== "2") problems.push(`exporting two services shows progress out of ${exporting}`);
    await page.getByText("Export ready").waitFor({ timeout: 3000 }).catch(() => problems.push("the export never finished with a toast"));
    if ((await services.locator("[data-dashboard-export]").count()) !== 0) problems.push("the export's progress bar outlived the export");
    await bulk.getByRole("button", { name: "Clear selection" }).click({ timeout: 2000 }).catch(() => undefined);
    if ((await services.locator("[data-table-bulk]").count()) !== 0) problems.push("Clear selection left the bulk bar");

    await services.getByRole("button", { name: "Next page" }).click();
    await page.waitForTimeout(100);
    const page2 = await page.evaluate(() => ({
      rows: document.querySelectorAll("[data-dashboard-services] tbody tr[data-table-row]").length,
      text: document.querySelector("[data-dashboard-services] [data-table-pagination]")?.textContent ?? "",
    }));
    if (page2.rows !== 4 || !page2.text.includes("11–14 of 14")) problems.push(`page 2: ${JSON.stringify(page2)}, expected 4 rows, 11–14 of 14`);
    await services.getByRole("button", { name: "Previous page" }).click();

    const team = services.getByRole("link", { name: "Payments" }).first();
    await team.scrollIntoViewIfNeeded();
    await team.hover();
    const card = page.locator("[data-dashboard-team='Payments']");
    await card.first().waitFor({ state: "visible", timeout: 2000 }).catch(() => problems.push("hovering a team opened no HoverCard"));
    const cardText = await card.first().textContent({ timeout: 1000 }).catch(() => "");
    if (!cardText?.includes("Mia Rossi")) problems.push(`the Payments card reads "${cardText}", expected its on-call`);
    await page.keyboard.press("Escape");
    await page.mouse.move(2, 2);
    await page.waitForTimeout(400);
    if (await card.first().isVisible()) problems.push("Escape did not close the team HoverCard");

    // 12: the rollout in the compact card is progress toward done.
    const ring = await page.evaluate(() => {
      const bars = [...document.querySelectorAll("[data-dashboard-compact] [role='progressbar']")];
      return bars.map((b) => `${b.getAttribute("aria-valuenow")}/${b.getAttribute("aria-valuemax")}`);
    });
    if (ring.length !== 1 || ring[0] !== "31/50") problems.push(`deploys card progress: ${JSON.stringify(ring)}, expected one ring at 31/50`);

    // 13: the maintenance banner.
    const banner = page.getByRole("region", { name: "Scheduled maintenance" });
    if (!(await banner.isVisible())) problems.push("the maintenance banner is not a visible region named by its title");
    await banner.getByRole("button", { name: "Dismiss" }).click();
    await page.waitForTimeout(100);
    const afterDismiss = await page.evaluate(() => ({
      gone: !document.querySelector("[data-dashboard-banner]"),
      focus: document.activeElement?.tagName === "H1" ? document.activeElement.textContent.trim() : document.activeElement?.tagName,
    }));
    if (!afterDismiss.gone || afterDismiss.focus !== "Platform overview") problems.push(`dismissing the banner: ${JSON.stringify(afterDismiss)}`);
    await page.reload();
    await waitForShowcase(page);
    await page.locator("[data-dashboard-kpis]").waitFor();
    if ((await page.locator("[data-dashboard-banner]").count()) !== 0) problems.push("the dismissed banner came back after a reload");
    await page.evaluate((key) => localStorage.removeItem(key), BANNER_KEY);
    await page.reload();
    await waitForShowcase(page);
    await page.locator("[data-dashboard-kpis]").waitFor();
    await page.waitForTimeout(250);

    // 3 + 4: the shell's three forms, by viewport.
    const wide = await shell();
    if (!wide.sidebar || wide.bottom) problems.push("1440: expected the sidebar and no bottom nav");
    if (!(wide.brandW > 1)) problems.push("1440: the brand name is hidden, so the sidebar is not the full one");
    if (!(wide.sidebarW > wide.control * 3)) problems.push(`1440: sidebar ${wide.sidebarW}px wide, too narrow for the full form`);
    if (!(wide.columnMd > 0) || Math.abs(wide.innerW - wide.columnMd) > 0.5) problems.push(`1440: the sidebar's column is ${wide.innerW}px wide, --COLUMN-MD is ${wide.columnMd}px`);
    if (wide.kpis !== 6 || wide.kpiRows !== 1) problems.push(`1440: ${wide.kpis} KPI tiles over ${wide.kpiRows} row(s), expected 6 in 1`);
    if (wide.hostSidebarCovered !== true) problems.push("1440: the showcase's own sidebar shows through the dashboard frame");
    if (wide.hostNav) problems.push("1440: the showcase's bottom nav shows beside the sidebar");
    if (wide.toolbar.role !== "toolbar" || wide.toolbar.name !== "Dashboard actions" || wide.toolbar.units !== 6) {
      problems.push(`1440: the header toolbar ${JSON.stringify(wide.toolbar)}, expected a named toolbar of 6 units`);
    }
    if (wide.toolbar.overflowed !== 0 || wide.toolbar.more) problems.push(`1440: ${wide.toolbar.overflowed} toolbar units are in "More"`);

    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForTimeout(250);
    const mid = await shell();
    if (!mid.sidebar || mid.bottom) problems.push("900: expected the rail and no bottom nav");
    if (mid.brandW > 1) problems.push("900: the brand name shows, so the sidebar is not a rail");
    if (!(mid.sidebarW < mid.control * 3)) problems.push(`900: sidebar ${mid.sidebarW}px wide, too wide for a rail`);

    await page.setViewportSize({ width: 375, height: 900 });
    await page.waitForTimeout(250);
    const narrow = await shell();
    if (narrow.sidebar || !narrow.bottom) problems.push("375: expected the bottom nav and no sidebar");
    if (narrow.toolbar.overflowed < 4 || !narrow.toolbar.more || !narrow.toolbar.moreInHeader) {
      problems.push(`375: the header toolbar ${JSON.stringify(narrow.toolbar)}, expected the four actions in a "More" inside the header`);
    }
    await page.getByRole("toolbar", { name: "Dashboard actions" }).getByRole("button", { name: "More" }).click();
    const moreItems = await page.evaluate(() =>
      [...document.querySelectorAll("[role=menu]:popover-open [role^='menuitem']")].map((i) => i.textContent.trim()),
    );
    for (const want of ["Refresh now", "Copy link to this view", "Export services as CSV", "Mute alerts for 1 hour"]) {
      if (!moreItems.includes(want)) problems.push(`375: "More" lists ${JSON.stringify(moreItems)}, missing "${want}"`);
    }
    await page.keyboard.press("Escape");
    if (!narrow.filtersFolded) problems.push("375: the FilterBar is not folded into its Filters button");
    const reach = (label, m) => {
      if (!m.hostNav) return problems.push(`${label}: the showcase's bottom nav is not shown`);
      if (m.hostNav.links < 4 || m.hostNav.hit !== m.hostNav.links) {
        problems.push(`${label}: ${m.hostNav.hit} of ${m.hostNav.links} showcase nav links are clear of the dashboard frame`);
      }
      if (m.hostNav.gap < -0.5) problems.push(`${label}: the dashboard frame overlaps the showcase nav by ${-m.hostNav.gap}px`);
    };
    reach("375", narrow);
    for (const e of errors) problems.push(`interactions: ${e}`);

    // 2: the matrix (and the KPI sparklines' --SPARK-H at each density): a fresh load
    // per width and for the combinations `viewMatrix` rotates in, a live switch for the rest.
    const sparkH = {};
    const themes = (await showcaseThemes(page)).map((t) => t.name);
    const sweep = await sweepViews(
      page,
      { themes, widths: [1440, 375] },
      {
        load: async ({ width, ...view }) => {
          errors.length = 0;
          await load(width, view);
        },
        check: async ({ density, input, width }, label) => {
          const m = await shell();
          if (m.docScroll > 0) problems.push(`${label}: document scrolls sideways by ${m.docScroll}px`);
          if (!(m.frameScroll <= 0)) problems.push(`${label}: the dashboard frame scrolls sideways by ${m.frameScroll}px`);
          if (width === 375) reach(label, m);
          if (m.boundaryErrors !== 0) problems.push(`${label}: ${m.boundaryErrors} card(s) fell back to their ErrorBoundary`);
          if (m.toolbar.controls < 1) problems.push(`${label}: harness: no header toolbar controls drawn`);
          if (input === "coarse" && m.toolbar.overlaps > 0) problems.push(`${label}: ${m.toolbar.overlaps} header toolbar hit areas overlap`);
          const drawn = await page.evaluate(
            () => document.querySelectorAll("[data-dashboard-frame] figure[data-chart] svg.r-charts-svg, [data-dashboard-frame] [data-cell]").length,
          );
          if (drawn < 169) problems.push(`${label}: the Dashboard's charts are not drawn (${drawn} plot parts)`);
          if (m.sparks.length < 3) problems.push(`${label}: harness: ${m.sparks.length} KPI sparklines`);
          for (const sp of m.sparks) {
            if (!(sp.token > 0) || Math.abs(sp.height - sp.token) > 0.5) problems.push(`${label}: a KPI sparkline is ${sp.height}px tall, --SPARK-H is ${sp.token}px`);
          }
          (sparkH[density] ??= new Set()).add(m.sparks[0]?.height);
          for (const e of errors) problems.push(`${label}: ${e}`);
          errors.length = 0;
        },
      },
    );
    combos = sweep.combos;
    summary.fresh = sweep.fresh.length;
    const [comfy, compact] = [sparkH.comfortable, sparkH.compact].map((set) => Math.min(...(set ?? [])));
    if (!(compact < comfy)) problems.push(`sparklines: ${compact}px at compact, ${comfy}px at comfortable; compact must be shorter`);
    summary.sparks = `${comfy}/${compact}px`;
  } finally {
    stopErrors();
    await page.evaluate(([key, banner]) => {
      localStorage.removeItem(key);
      localStorage.removeItem(banner);
    }, [KEY, BANNER_KEY]);
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  if (problems.length) throw new Error(`dashboard-layout FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dashboard-layout OK (rows: page ${summary.page}px, compact card ${summary.card}px; incidents timeline: ${summary.incidents} events; shell full/rail/bottom nav at 1440/900/375; showcase nav reachable at 375; charts: ${summary.charts}; sparklines ${summary.sparks} at comfortable/compact; sidebar --COLUMN-MD; FilterBar ↔ table, charts and URL; toolbar overflow and coarse spacing; table features, rollout progress, banner, HoverCard; ${combos} combinations clean (${summary.fresh} loaded fresh), no boundary tripped)`;
}
