// Browser check: FilterBar chips, focus, result count and the keyboard-only path.
//
// Run it through `bun run browser:check filters-bar`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print filters-bar)"
//
// jsdom has no layout (so it cannot tell which of the folded and inline controls
// is drawn), no real focus order across the composed controls and no timing of a
// live region. On the Overview's FilterBar section, the dashboard bar
// (`[data-sc="filters-dashboard"]`), it asserts:
//   1. harness: the bar is inline at 1280 (its own width ≥ the container 2xl step,
//      every control drawn, the Filters button not); it opened on the sample URL,
//      so the chips are exactly "Region: us-east, eu-west" (option order), "p95 ≥ 300 ms",
//      "Last 30 days" and the query line holds those parameters; the shown count
//      equals the table's own total (its pager's "of N") and the polite status
//      (role=status, not assertive) speaks the same words;
//   2. Clear all by keyboard (Enter): no chip is left, the query line is "(none)",
//      focus is on the first control (the Region combobox); the shown count is
//      the whole fleet (48) at once while the status still speaks the old count,
//      and speaks "48 results" once it has settled;
//   3. keyboard only, from there: typing "eu" + Enter chooses eu-west; Tab to the
//      Status toggles, ArrowRight × 3 + Space presses Down; Tab to the p95
//      Minimum thumb, ArrowRight × 6 makes it 300; Tab to the Deployed trigger,
//      Enter opens the picker, Tab to "Last 7 days", Enter applies it and focus
//      is back on the trigger; Tab to the search, typing "api". The chips are
//      exactly the five filters in definition order with the right words, the
//      query line has each parameter, and the count again equals the table's;
//   4. Tab reaches the chips' remove buttons, each named "Remove filter <chip>";
//      Enter on the first removes Region (its MultiSelect empties) and focus
//      goes to the chip that took its place (Status); Delete removes Status (its
//      Down toggle un-presses) and focus moves on to the p95 chip; from the
//      last chip (Search) Enter removes it, the search box empties and focus
//      goes to the chip before it;
//   5. Tab to Clear all, Enter: no chips, focus on the Region combobox again;
//   6. no console or page error from the section.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}#/overview/filters-filterbar`);
  await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [SHOWCASE_VIEW_KEY, { theme: "default", density: "comfortable", input: "fine" }]);
  await page.reload();
  await waitForShowcase(page);

  const SCOPE = '[data-sc="filters-dashboard"]';
  const BAR = `${SCOPE} [role="search"]`;
  const bar = page.locator(BAR);
  await bar.waitFor();
  await bar.scrollIntoViewIfNeeded();

  const chips = () => bar.locator("[data-filter-chip]").evaluateAll((els) => els.map((el) => el.querySelector("span")?.textContent ?? ""));
  const focus = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        name: a?.getAttribute("aria-label") ?? a?.textContent?.trim() ?? "",
        role: a?.getAttribute("role") ?? a?.tagName.toLowerCase(),
        filter: a?.closest("[data-filter]")?.getAttribute("data-filter") ?? null,
        chip: a?.closest("[data-filter-chip]")?.getAttribute("data-filter-chip") ?? null,
        clear: a?.textContent?.trim() === "Clear all",
      };
    });
  const results = () =>
    bar.evaluate((b) => {
      const r = b.querySelector("[data-filter-results]");
      const status = r?.querySelector('[role="status"]');
      return {
        shown: r?.querySelector("[aria-hidden]")?.textContent ?? null,
        spoken: status?.textContent ?? null,
        live: status ? status.getAttribute("aria-live") ?? "polite (role=status)" : null,
      };
    });
  const tableTotal = async () => {
    const text = (await page.locator(`${SCOPE} [data-table-pagination] > [aria-live="polite"]`).textContent()) ?? "";
    const m = /of\s+([\d,]+)/.exec(text);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  const query = async () => (await page.locator('[data-sc="filters-query"]').textContent()) ?? "";
  const countOf = (text) => Number((/^([\d,]+) results?$/.exec(text ?? "")?.[1] ?? "NaN").replace(/,/g, ""));
  /** Tab until `pred(focus)` holds, at most `max` presses. */
  const tabTo = async (pred, what, max = 12) => {
    for (let i = 0; i < max; i += 1) {
      await page.keyboard.press("Tab");
      if (pred(await focus())) return true;
    }
    fail.push(`keyboard: Tab never reached ${what} (last focus ${JSON.stringify(await focus())})`);
    return false;
  };

  // ── 1: harness, the sample URL, the count ─────────────────────────────────
  const layout = await bar.evaluate((b) => {
    const drawn = (el) => el.getClientRects().length > 0;
    const fields = [...b.querySelectorAll(":scope > div > [data-filter]")];
    const trigger = b.querySelector("[data-filter-trigger]");
    return { width: b.clientWidth, fields: fields.length, drawn: fields.filter(drawn).length, trigger: trigger ? drawn(trigger) : null };
  });
  summary.width = layout.width;
  if (layout.width < 672) fail.push(`harness: the dashboard bar is ${layout.width}px wide at 1280, under the 2xl step (672px)`);
  if (layout.fields !== 5 || layout.drawn !== 5) fail.push(`harness: inline at 1280 expects 5 drawn controls, found ${layout.drawn} of ${layout.fields}`);
  if (layout.trigger !== false) fail.push(`harness: the Filters button is ${layout.trigger === null ? "missing" : "drawn"} in the wide bar`);
  const start = await chips();
  if (JSON.stringify(start) !== JSON.stringify(["Region: us-east, eu-west", "p95 ≥ 300 ms", "Last 30 days"])) fail.push(`URL start: chips ${JSON.stringify(start)}`);
  const q0 = await query();
  for (const part of ["region=eu-west", "region=us-east", "p95=300..", "deployed=last-30-days"]) if (!q0.includes(part)) fail.push(`URL start: the query line "${q0}" lacks ${part}`);
  await page.waitForTimeout(700);
  const r0 = await results();
  const t0 = await tableTotal();
  if (countOf(r0.shown) !== t0) fail.push(`count: shown "${r0.shown}" but the table totals ${t0}`);
  if (r0.spoken !== r0.shown) fail.push(`count: the status speaks "${r0.spoken}", the bar shows "${r0.shown}"`);
  if (r0.live === null || r0.live === "assertive") fail.push(`count: the status is ${r0.live}, expected polite`);
  summary.start = { chips: start, count: r0.shown };

  // ── 2: Clear all by keyboard ──────────────────────────────────────────────
  await bar.getByRole("button", { name: "Clear all" }).focus();
  await page.keyboard.press("Enter");
  if ((await chips()).length !== 0) fail.push(`Clear all left chips ${JSON.stringify(await chips())}`);
  if ((await query()).trim() !== "(none)") fail.push(`Clear all: the query line is "${await query()}"`);
  const f2 = await focus();
  if (f2.filter !== "region" || f2.role !== "combobox") fail.push(`Clear all: focus is on ${JSON.stringify(f2)}, expected the Region combobox`);
  const r2a = await results();
  if (r2a.shown !== "48 results") fail.push(`Clear all: shows "${r2a.shown}" at once, expected "48 results"`);
  if (r2a.spoken !== r0.spoken) fail.push(`Clear all: the status spoke "${r2a.spoken}" at once; it waits for the count to settle`);
  await page.waitForTimeout(800);
  const r2b = await results();
  if (r2b.spoken !== "48 results") fail.push(`Clear all: the status speaks "${r2b.spoken}" once settled, expected "48 results"`);

  // ── 3: keyboard only ──────────────────────────────────────────────────────
  await page.keyboard.type("eu");
  await page.keyboard.press("Enter");
  await tabTo((f) => f.filter === "status", "the Status toggles");
  for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
  const onDown = await focus();
  if (onDown.name !== "Down") fail.push(`keyboard: ArrowRight × 3 in Status lands on "${onDown.name}", expected Down`);
  await page.keyboard.press("Space");
  await tabTo((f) => f.filter === "p95" && f.name === "Minimum", "the p95 Minimum thumb");
  for (let i = 0; i < 6; i += 1) await page.keyboard.press("ArrowRight");
  await tabTo((f) => f.filter === "deployed", "the Deployed picker");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Choose a date range" }).waitFor();
  await tabTo((f) => f.name === "Last 7 days", "the Last 7 days preset");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const back = await focus();
  if (back.filter !== "deployed" || back.role !== "button") fail.push(`keyboard: after the preset focus is on ${JSON.stringify(back)}, expected the Deployed trigger`);
  await tabTo((f) => f.filter === "q", "the search box");
  await page.keyboard.type("api");
  const applied = await chips();
  const expected = ["Region: eu-west", "Status: Down", "p95 ≥ 300 ms", "Last 7 days", "Search: “api”"];
  if (JSON.stringify(applied) !== JSON.stringify(expected)) fail.push(`keyboard: chips ${JSON.stringify(applied)}, expected ${JSON.stringify(expected)}`);
  const q3 = await query();
  for (const part of ["region=eu-west", "status=error", "p95=300..", "deployed=last-7-days", "q=api"]) if (!q3.includes(part)) fail.push(`keyboard: the query line "${q3}" lacks ${part}`);
  await page.waitForTimeout(800);
  const r3 = await results();
  const t3 = await tableTotal();
  if (countOf(r3.shown) !== t3 || r3.spoken !== r3.shown) fail.push(`keyboard: shown "${r3.shown}", spoken "${r3.spoken}", table ${t3}`);
  summary.applied = { chips: applied, count: r3.shown };

  // ── 4: chips by keyboard ──────────────────────────────────────────────────
  if (await tabTo((f) => f.chip !== null, "a chip's remove button")) {
    const first = await focus();
    if (first.chip !== "region" || first.name !== "Remove filter Region: eu-west") fail.push(`chips: the first remove button is ${JSON.stringify(first)}`);
    await page.keyboard.press("Enter");
    const afterRegion = await focus();
    if (afterRegion.chip !== "status") fail.push(`chips: after removing Region focus is on ${JSON.stringify(afterRegion)}, expected the Status chip`);
    const regionChips = await bar.locator('[data-filter="region"] .r-primitives-chip').count();
    if (regionChips !== 0) fail.push(`chips: the Region MultiSelect still holds ${regionChips} chip(s)`);
    await page.keyboard.press("Delete");
    const afterStatus = await focus();
    if (afterStatus.chip !== "p95") fail.push(`chips: Delete on Status moved focus to ${JSON.stringify(afterStatus)}, expected the p95 chip`);
    if ((await bar.getByRole("button", { name: "Down", exact: true }).getAttribute("aria-pressed")) !== "false") fail.push("chips: removing Status left Down pressed");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const last = await focus();
    if (last.chip !== "q") fail.push(`chips: two Tabs from p95 reach ${JSON.stringify(last)}, expected the Search chip`);
    await page.keyboard.press("Enter");
    const afterLast = await focus();
    if (afterLast.chip !== "deployed") fail.push(`chips: removing the last chip moved focus to ${JSON.stringify(afterLast)}, expected the one before (Deployed)`);
    if ((await bar.getByRole("searchbox").inputValue()) !== "") fail.push("chips: removing Search left text in the search box");
    const left = await chips();
    if (JSON.stringify(left) !== JSON.stringify(["p95 ≥ 300 ms", "Last 7 days"])) fail.push(`chips: left ${JSON.stringify(left)}`);
  }

  // ── 5: Clear all by keyboard, from the chips ──────────────────────────────
  if (await tabTo((f) => f.clear, "Clear all", 4)) {
    await page.keyboard.press("Enter");
    const f5 = await focus();
    if ((await chips()).length !== 0 || f5.filter !== "region" || f5.role !== "combobox") fail.push(`Clear all from the chips: ${(await chips()).length} chips, focus ${JSON.stringify(f5)}`);
  }

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`filters-bar FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(summary)}`);
  return `filters-bar OK ${JSON.stringify(summary)}`;
}
