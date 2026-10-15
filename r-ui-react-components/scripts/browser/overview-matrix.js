// Browser check: the whole Overview page renders cleanly on every axis.
//
// For default / nightfall / harbour × comfortable / compact × fine / coarse at
// 1280 and 375 wide, it reloads the Overview with that View and asserts:
//   1. the harness reads what the source predicts: --HIT-MIN is 24px on fine and
//      44px on coarse, and --CONTROL-H is max(the theme's named value for the
//      density, --HIT-MIN) (a theme may retune what a density means);
//   2. every discovered section rendered, and no section's error boundary tripped
//      (`[data-section-error]`), so one broken demo cannot hide behind the rest;
//   3. no console error and no uncaught page error during the load;
//   4. no horizontal page scroll (documentElement.scrollWidth <= clientWidth), and
//      no demo box scrolls sideways either (`.sc-demo` is `overflow-x: auto`, so a
//      component that cannot shrink to its container hides behind a scrollbar there).
//
// Run it through `bun run browser:check`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(cat scripts/browser/overview-matrix.js)"
async (page) => {
  const THEMES = ["default", "nightfall", "harbour"];
  const DENSITIES = ["comfortable", "compact"];
  const INPUTS = { fine: 24, coarse: 44 };
  const WIDTHS = [1280, 375];
  const base = page.url().split("#")[0];

  const problems = [];
  const errors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  };
  const onPageError = (err) => errors.push(`pageerror: ${err.message}`);
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  let combos = 0;
  let sectionCount = null;
  try {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of THEMES) {
        for (const density of DENSITIES) {
          for (const [input, hitPx] of Object.entries(INPUTS)) {
            const label = `${theme}/${density}/${input}@${width}`;
            errors.length = 0;
            await page.goto(`${base}#/overview`);
            await page.evaluate((view) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(view)), {
              theme,
              density,
              input,
            });
            await page.reload();
            await page.locator(".sc-section").first().waitFor();
            await page.waitForTimeout(250);

            const m = await page.evaluate((density) => {
              const html = document.documentElement;
              const css = getComputedStyle(html);
              const px = (name) => {
                const v = css.getPropertyValue(name).trim();
                if (v.endsWith("rem")) return Number.parseFloat(v) * Number.parseFloat(css.fontSize);
                return v.endsWith("px") ? Number.parseFloat(v) : Number.NaN;
              };
              return {
                hit: px("--HIT-MIN"),
                named: px(`--CONTROL-H-${density.toUpperCase()}`),
                control: Number.parseFloat(css.getPropertyValue("--CONTROL-H")),
                sections: document.querySelectorAll(".sc-section").length,
                demos: [...document.querySelectorAll(".sc-section .sc-demo")].filter((d) => d.childElementCount > 0).length,
                tripped: [...document.querySelectorAll("[data-section-error]")].map((e) => e.getAttribute("data-section-error")),
                invalid: document.querySelectorAll(".sc-invalid:not([data-section-error])").length,
                overflowing: [...document.querySelectorAll(".sc-section")]
                  .filter((sec) => {
                    const demo = sec.querySelector(".sc-demo");
                    return demo && demo.scrollWidth > demo.clientWidth + 1;
                  })
                  .map((sec) => sec.id),
                scrollWidth: html.scrollWidth,
                clientWidth: html.clientWidth,
              };
            }, density);
            combos++;
            if (m.hit !== hitPx) problems.push(`${label}: harness --HIT-MIN ${m.hit}px, source predicts ${hitPx}px`);
            if (!(m.named > 0)) problems.push(`${label}: harness could not read --CONTROL-H-${density.toUpperCase()}`);
            if (m.control !== Math.max(m.named, hitPx)) {
              problems.push(`${label}: --CONTROL-H ${m.control}px, expected max(${m.named}, ${hitPx})`);
            }
            if (m.sections === 0) problems.push(`${label}: no sections rendered`);
            if (sectionCount === null) sectionCount = m.sections;
            else if (m.sections !== sectionCount) problems.push(`${label}: ${m.sections} sections, first load had ${sectionCount}`);
            if (m.demos !== m.sections) problems.push(`${label}: ${m.sections - m.demos} section(s) rendered an empty demo`);
            if (m.tripped.length) problems.push(`${label}: section error boundary tripped in ${m.tripped.join(", ")}`);
            if (m.invalid) problems.push(`${label}: ${m.invalid} invalid section file(s) reported`);
            if (m.scrollWidth > m.clientWidth) problems.push(`${label}: horizontal scroll (${m.scrollWidth} > ${m.clientWidth})`);
            if (m.overflowing.length) problems.push(`${label}: demo content wider than its box in ${m.overflowing.join(", ")}`);
            for (const e of errors) problems.push(`${label}: ${e}`);
          }
        }
      }
    }
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
    await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  if (problems.length) throw new Error(`overview-matrix FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  return `overview-matrix OK (${combos} combinations, ${sectionCount} sections each)`;
}
