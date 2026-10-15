// Browser check: the Stress page holds on every axis, and its known library
// bugs still reproduce.
//
// For default / nightfall / harbour × comfortable / compact × fine / coarse at
// 1280 and 375 wide, it reloads the Stress page with that View and asserts:
//   1. harness: --HIT-MIN is 24px on fine and 44px on coarse, and every panel
//      the source declares (6) rendered with no tripped error boundary;
//   2. no console error and no uncaught page error during the load;
//   3. no horizontal page scroll, no panel's demo box scrolling sideways, and
//      (stricter than the Overview matrix) no element inside a panel with a child
//      box or text line reaching past its own edges while it lets it show
//      (`overflow-x: visible`). That is how a card's text pushes out of the card
//      even when the page itself does not scroll. Scroll containers and clipped
//      (truncating) boxes are their own business and are skipped;
//   4. every `[data-known-bug]` case (a library bug, kept as a live repro inside
//      its own scroll box, which is why 3 skips it) still overflows at 375 in
//      the default view. When the library is fixed this goes red: move the case
//      out of KnownBug so 3 guards it from then on.
//
// Run it through `bun run browser:check stress`, or by hand against a showcase:
//   playwright-cli -s=<session> run-code "$(cat scripts/browser/stress-matrix.js)"
async (page) => {
  const THEMES = ["default", "nightfall", "harbour"];
  const DENSITIES = ["comfortable", "compact"];
  const INPUTS = { fine: 24, coarse: 44 };
  const WIDTHS = [1280, 375];
  const PANELS = 6;
  // Empty: every reported case was fixed and now lives in the open, guarded by 3.
  const KNOWN_BUGS = [];
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
  let known = null;
  try {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of THEMES) {
        for (const density of DENSITIES) {
          for (const [input, hitPx] of Object.entries(INPUTS)) {
            const label = `${theme}/${density}/${input}@${width}`;
            errors.length = 0;
            await page.goto(`${base}#/stress`);
            await page.evaluate((view) => localStorage.setItem("r-ui-showcase:view", JSON.stringify(view)), { theme, density, input });
            await page.reload();
            await page.locator("[data-stress-panel]").first().waitFor();
            await page.waitForTimeout(300);

            const m = await page.evaluate(() => {
              const html = document.documentElement;
              const css = getComputedStyle(html);
              const hit = Number.parseFloat(css.getPropertyValue("--HIT-MIN")) * Number.parseFloat(css.fontSize);
              // Child boxes, not scrollWidth: a `hit-area` pseudo-element is meant to
              // reach past its control, and it would read as overflow there.
              const spills = (el) => {
                if (el.closest("[data-known-bug-box]")) return false;
                const cs = getComputedStyle(el);
                if (cs.overflowX !== "visible" || cs.display === "inline" || cs.display === "contents") return false;
                const box = el.getBoundingClientRect();
                if (box.width === 0) return false;
                const range = document.createRange();
                for (const child of el.childNodes) {
                  let r;
                  if (child.nodeType === Node.ELEMENT_NODE) {
                    const ccs = getComputedStyle(child);
                    if (ccs.position === "fixed" || ccs.position === "absolute" || child.matches(":popover-open, dialog")) continue;
                    r = child.getBoundingClientRect();
                  } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    range.selectNodeContents(child);
                    r = range.getBoundingClientRect();
                  } else continue;
                  if (r.width === 0 && r.height === 0) continue;
                  if (r.right > box.right + 1 || r.left < box.left - 1) return `${Math.round(r.width)} wide in ${Math.round(box.width)}`;
                }
                return false;
              };
              const describe = (el, why) =>
                `${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ""}.${String(el.className).split(" ").slice(0, 3).join(".")} "${el.textContent.trim().slice(0, 24)}" (${why})`;
              const panels = [...document.querySelectorAll("[data-stress-panel]")];
              return {
                hit,
                panels: panels.length,
                tripped: [...document.querySelectorAll("[data-section-error]")].map((e) => e.getAttribute("data-section-error")),
                page: [html.scrollWidth, html.clientWidth],
                demos: panels
                  .filter((p) => {
                    const d = p.querySelector(".sc-demo");
                    return d.scrollWidth > d.clientWidth + 1;
                  })
                  .map((p) => p.id),
                spilling: panels.flatMap((p) =>
                  [...p.querySelectorAll(".sc-demo *")].flatMap((el) => {
                    const why = spills(el);
                    return why ? [`${p.id}: ${describe(el, why)}`] : [];
                  }),
                ),
                known: Object.fromEntries(
                  [...document.querySelectorAll("[data-known-bug]")].map((k) => {
                    const box = k.querySelector("[data-known-bug-box]");
                    return [k.getAttribute("data-known-bug"), box.scrollWidth > box.clientWidth + 1];
                  }),
                ),
              };
            });
            combos++;
            if (m.hit !== hitPx) problems.push(`${label}: harness --HIT-MIN ${m.hit}px, source predicts ${hitPx}px`);
            if (m.panels !== PANELS) problems.push(`${label}: ${m.panels} panels rendered, the page declares ${PANELS}`);
            if (m.tripped.length) problems.push(`${label}: error boundary tripped in ${m.tripped.join(", ")}`);
            if (m.page[0] > m.page[1]) problems.push(`${label}: horizontal page scroll (${m.page[0]} > ${m.page[1]})`);
            if (m.demos.length) problems.push(`${label}: panel scrolls sideways: ${m.demos.join(", ")}`);
            for (const s of m.spilling.slice(0, 8)) problems.push(`${label}: content spills: ${s}`);
            if (m.spilling.length > 8) problems.push(`${label}: …and ${m.spilling.length - 8} more spilling elements`);
            for (const e of errors) problems.push(`${label}: ${e}`);
            if (width === 375 && theme === "default" && density === "comfortable" && input === "fine") known = m.known;
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

  for (const id of KNOWN_BUGS) {
    if (!known || !(id in known)) problems.push(`known bug "${id}": its repro is missing from the page`);
    else if (!known[id]) problems.push(`known bug "${id}" no longer reproduces at 375: fixed? move it out of KnownBug so the matrix guards it`);
  }
  if (known && Object.keys(known).length !== KNOWN_BUGS.length) {
    problems.push(`the page has known-bug repros ${Object.keys(known).join(", ")}; this script lists ${KNOWN_BUGS.join(", ")}`);
  }

  if (problems.length) throw new Error(`stress-matrix FAILED (${problems.length}):\n  ${problems.join("\n  ")}`);
  const knownNote = KNOWN_BUGS.length ? `known library bugs still reproduce: ${KNOWN_BUGS.join(", ")}` : "no known library bugs";
  return `stress-matrix OK (${combos} combinations × ${PANELS} panels; no page or panel overflow, no spilling content, no console error; ${knownNote})`;
}
