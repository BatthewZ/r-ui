// Browser check: the Dashboard page is a real dashboard on every axis.
//
// Run it through `bun run browser:check dashboard`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(cat scripts/browser/dashboard-layout.js)"
//
// Asserts:
//   1. harness: at fine input --HIT-MIN is 24px, so --ROW-H is the density's own
//      named value (`--ROW-H-COMFORTABLE` / `-COMPACT`) and the comparison in 5 means something;
//   2. default / nightfall / harbour × comfortable / compact × fine / coarse at 1440
//      and 375: no console or page error, no horizontal scroll in the document or
//      in the dashboard's own scroll frame;
//   3. at 1440 the AppShell sidebar is the FULL sidebar (brand name shown, wider
//      than a rail) and the six KPI tiles sit in one row;
//   4. at 900 the sidebar is the icon RAIL (brand name visually hidden, rail-wide)
//      and there is no bottom nav; at 375 the BOTTOM NAV shows and the sidebar does not;
//   5. at comfortable + fine: every services row is exactly its --ROW-H, every row
//      in the compact card (`data-density="compact"`) is exactly ITS --ROW-H, and
//      that is shorter than the page's;
//   6. searching for nothing shows the table's EmptyState and "Clear search" brings
//      the rows back; a header menu action raises a toast.
async (page) => {
  const base = page.url().split("#")[0];
  const KEY = "r-ui-showcase:view";
  const problems = [];
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  };
  const onPageError = (err) => errors.push(`pageerror: ${err.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const load = async (width, view) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/dashboard`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [KEY, view]);
    await page.reload();
    await page.locator("[data-dashboard-kpis]").waitFor();
    await page.waitForTimeout(250);
  };

  const shell = () =>
    page.evaluate(() => {
      const box = (el) => (el ? el.getBoundingClientRect() : null);
      const shown = (el) => !!el && getComputedStyle(el).display !== "none" && box(el).width > 0;
      const sidebar = document.querySelector(".r-navigation-shell-sidebar");
      const brandName = document.querySelector(".r-navigation-shell-sidebar .r-navigation-shell-brand-name");
      const css = getComputedStyle(document.documentElement);
      const frame = document.querySelector("[data-dashboard-frame]");
      const kpiTops = [...document.querySelectorAll("[data-dashboard-kpis] > *")].map((k) => Math.round(box(k).top));
      return {
        sidebar: shown(sidebar),
        sidebarW: sidebar ? box(sidebar).width : 0,
        brandW: brandName ? box(brandName).width : 0,
        bottom: shown(document.querySelector(".r-navigation-shell-bottomnav")),
        control: Number.parseFloat(css.getPropertyValue("--CONTROL-H")),
        kpis: kpiTops.length,
        kpiRows: new Set(kpiTops).size,
        docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        frameScroll: frame ? frame.scrollWidth - frame.clientWidth : Number.NaN,
      };
    });

  let combos = 0;
  const summary = { page: Number.NaN, card: Number.NaN };
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
        [...document.querySelectorAll(`${scope} tbody tr`)].map((tr) => ({
          h: tr.getBoundingClientRect().height,
          rowH: Number.parseFloat(getComputedStyle(tr).getPropertyValue("--ROW-H")),
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
    if (rows.page.length < 10) problems.push(`services table rendered ${rows.page.length} rows`);
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
    const cardH = rows.card[0]?.h ?? Number.NaN;
    const pageH = rows.page[0]?.h ?? Number.NaN;
    summary.page = pageH;
    summary.card = cardH;
    if (!(cardH < pageH)) problems.push(`compact card rows (${cardH}px) are not shorter than the page's (${pageH}px)`);

    // 6: a search that matches nothing shows the EmptyState, and its action clears it.
    const services = page.locator("[data-dashboard-services]");
    await page.getByRole("searchbox", { name: "Search services" }).fill("zzz-no-such-service");
    const empty = services.getByText("No services match");
    if (!(await empty.isVisible())) problems.push("filtering the services table to nothing shows no EmptyState");
    await services.getByRole("button", { name: "Clear search" }).click();
    const restored = await services.locator("tbody tr").count();
    if (restored !== rows.page.length) problems.push(`"Clear search" restored ${restored} rows, expected ${rows.page.length}`);

    await page.getByRole("button", { name: "Dashboard actions" }).click();
    await page.getByRole("menuitem", { name: "Refresh now" }).click();
    const toast = page.getByText("Dashboard refreshed");
    await toast.waitFor({ timeout: 3000 }).catch(() => problems.push("the Refresh now action raised no toast"));

    // 3 + 4: the shell's three forms, by viewport.
    const wide = await shell();
    if (!wide.sidebar || wide.bottom) problems.push("1440: expected the sidebar and no bottom nav");
    if (!(wide.brandW > 1)) problems.push("1440: the brand name is hidden, so the sidebar is not the full one");
    if (!(wide.sidebarW > wide.control * 3)) problems.push(`1440: sidebar ${wide.sidebarW}px wide, too narrow for the full form`);
    if (wide.kpis !== 6 || wide.kpiRows !== 1) problems.push(`1440: ${wide.kpis} KPI tiles over ${wide.kpiRows} row(s), expected 6 in 1`);

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
    for (const e of errors) problems.push(`interactions: ${e}`);

    // 2: the matrix.
    for (const width of [1440, 375]) {
      for (const theme of ["default", "nightfall", "harbour"]) {
        for (const density of ["comfortable", "compact"]) {
          for (const input of ["fine", "coarse"]) {
            const label = `${theme}/${density}/${input}@${width}`;
            errors.length = 0;
            await load(width, { theme, density, input });
            const m = await shell();
            combos++;
            if (m.docScroll > 0) problems.push(`${label}: document scrolls sideways by ${m.docScroll}px`);
            if (!(m.frameScroll <= 0)) problems.push(`${label}: the dashboard frame scrolls sideways by ${m.frameScroll}px`);
            for (const e of errors) problems.push(`${label}: ${e}`);
          }
        }
      }
    }
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    await page.evaluate((key) => localStorage.removeItem(key), KEY);
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  if (problems.length) throw new Error(`dashboard-layout FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `dashboard-layout OK (rows: page ${summary.page}px, compact card ${summary.card}px; shell full/rail/bottom nav at 1440/900/375; ${combos} combinations clean)`;
}
