// Browser check: FilterBar layout by its own width, the drawer, touch floors and 375.
//
// Run it through `bun run browser:check filters-layout`, or by hand against a running showcase:
//   playwright-cli -s=<session> open http://localhost:<port>/
//   playwright-cli -s=<session> run-code "$(node scripts/browser-check.mjs --print filters-layout)"
//
// jsdom applies no container query, opens no modal in the top layer and has no
// pointer geometry. On the Overview's FilterBar section it asserts:
//   1. harness: at 1280 the dashboard bar is at least the container 2xl step
//      (672px) wide and the narrow box's bar is under it, in the same viewport,
//      so the fold below is the container's doing and not the viewport's;
//   2. the narrow bar is folded: its Filters button is drawn and says
//      "Filters (2)", none of its inline controls is drawn, its chips
//      ("Region: eu-west", "Status: Degraded, Down") and count are;
//   3. keyboard: Enter on the button opens a modal (`:modal`, in the top layer)
//      named "Filters", in place inside the narrow box, inside the viewport,
//      holding the same filters as the wide bar in the same order, each drawn;
//      Tab reaches its Status toggles, Space on the first (Healthy) adds it and
//      the chip outside reads "Status: Healthy, Degraded, Down"; typing in its
//      search adds a filter and the button says "Filters (3)"; Escape closes it
//      and focus is back on the button;
//   4. Clear all (Enter) in the folded bar empties it and puts focus on the
//      Filters button, the first control drawn;
//   5. right to left: a chip's remove button is on the chip's inline end (left);
//   6. compact density + coarse input: harness --HIT-MIN 44px and --CONTROL-H
//      44px; every chip's remove button answers a 44 × 44 hit area (box ∪
//      ::before) and a press at its centre reaches it; a chip line is exactly
//      one --CONTROL-H (chip height + the row gap); Clear all and the narrow
//      Filters button are --CONTROL-H tall;
//   7. at 375 (coarse): the page does not scroll sideways; the dashboard bar
//      folds too; no bar in the section is wider than its box or reaches past
//      the page, no chip past its bar, and the long chips truncate (text
//      clipped inside the chip) instead; the dashboard's drawer opens inside
//      the viewport and its content does not scroll sideways.
async (page) => {
  const base = page.url().split("#")[0];
  const fail = [];
  const summary = {};
  const { errors, stop: stopErrors } = collectErrors(page);

  const load = async ({ density = "comfortable", input = "fine", width = 1280 } = {}) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}#/overview/filters-filterbar`);
    await page.evaluate(([key, v]) => localStorage.setItem(key, JSON.stringify(v)), [SHOWCASE_VIEW_KEY, { theme: "default", density, input }]);
    await page.reload();
    await waitForShowcase(page);
    await page.locator('[data-sc="filters-narrow"] [role="search"]').waitFor();
  };
  const WIDE = '[data-sc="filters-dashboard"] [role="search"]';
  const NARROW = '[data-sc="filters-narrow"] [role="search"]';
  const state = (sel) =>
    page.evaluate((s) => {
      const b = document.querySelector(s);
      const drawn = (el) => el.getClientRects().length > 0;
      const fields = [...b.querySelectorAll(":scope > div > [data-filter]")];
      const trigger = b.querySelector("[data-filter-trigger]");
      return {
        width: b.clientWidth,
        ids: fields.map((f) => f.getAttribute("data-filter")),
        drawnFields: fields.filter(drawn).length,
        trigger: trigger && drawn(trigger) ? trigger.textContent.trim() : null,
        chips: [...b.querySelectorAll("[data-filter-chip]")].map((c) => c.querySelector("span")?.textContent ?? ""),
        count: b.querySelector("[data-filter-results] [aria-hidden]")?.textContent ?? null,
      };
    }, sel);
  const focus = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return { name: a?.getAttribute("aria-label") ?? a?.textContent?.trim() ?? "", filter: a?.closest("[data-filter]")?.getAttribute("data-filter") ?? null, trigger: a?.hasAttribute("data-filter-trigger") ?? false };
    });

  await load();

  // ── 1–2: the container decides ────────────────────────────────────────────
  const wide = await state(WIDE);
  const narrow = await state(NARROW);
  summary.widths = { wide: wide.width, narrow: narrow.width };
  if (wide.width < 672 || narrow.width >= 672) fail.push(`harness: bars ${wide.width}px and ${narrow.width}px should straddle the 2xl step (672px) at 1280`);
  if (wide.trigger !== null || wide.drawnFields !== wide.ids.length) fail.push(`harness: the wide bar is not inline (${JSON.stringify(wide)})`);
  if (narrow.trigger !== "Filters (2)") fail.push(`narrow: the Filters button reads ${JSON.stringify(narrow.trigger)}, expected "Filters (2)"`);
  if (narrow.ids.length === 0 || narrow.drawnFields !== 0) fail.push(`narrow: ${narrow.drawnFields} of ${narrow.ids.length} inline controls drawn, expected none`);
  if (JSON.stringify(narrow.chips) !== JSON.stringify(["Region: eu-west", "Status: Degraded, Down"])) fail.push(`narrow: chips ${JSON.stringify(narrow.chips)}`);
  if (!/^\d[\d,]* results?$/.test(narrow.count ?? "")) fail.push(`narrow: count ${JSON.stringify(narrow.count)}`);

  // ── 3: the drawer, by keyboard ────────────────────────────────────────────
  const narrowBar = page.locator(NARROW);
  const trigger = narrowBar.locator("[data-filter-trigger]");
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = narrowBar.locator("dialog");
  await dialog.waitFor();
  await page.waitForTimeout(400);
  const drawer = await dialog.evaluate((d) => {
    const r = d.getBoundingClientRect();
    const labelId = d.getAttribute("aria-labelledby");
    return {
      modal: d.matches(":modal"),
      name: labelId ? document.getElementById(labelId)?.textContent : null,
      inPlace: Boolean(d.closest('[data-sc="filters-narrow"]')),
      inside: r.left >= -0.5 && r.right <= document.documentElement.clientWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5,
      ids: [...d.querySelectorAll("[data-filter]")].map((f) => f.getAttribute("data-filter")),
      drawn: [...d.querySelectorAll("[data-filter]")].every((f) => f.getClientRects().length > 0),
    };
  });
  if (!drawer.modal || drawer.name !== "Filters" || !drawer.inPlace || !drawer.inside) fail.push(`drawer: ${JSON.stringify(drawer)}`);
  if (JSON.stringify(drawer.ids) !== JSON.stringify(wide.ids) || !drawer.drawn) fail.push(`drawer holds ${JSON.stringify(drawer.ids)} (drawn ${drawer.drawn}), the wide bar ${JSON.stringify(wide.ids)}`);
  let reached = false;
  for (let i = 0; i < 12 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    reached = (await focus()).filter === "status";
  }
  if (!reached) fail.push("drawer: Tab never reached the Status toggles");
  const firstToggle = await focus();
  if (firstToggle.name !== "Healthy") fail.push(`drawer: the Status tab stop is "${firstToggle.name}", expected Healthy`);
  await page.keyboard.press("Space");
  const afterToggle = await state(NARROW);
  if (!afterToggle.chips.includes("Status: Healthy, Degraded, Down")) fail.push(`drawer: after Healthy the chips are ${JSON.stringify(afterToggle.chips)}`);
  reached = false;
  for (let i = 0; i < 12 && !reached; i += 1) {
    await page.keyboard.press("Tab");
    reached = (await focus()).filter === "q";
  }
  if (!reached) fail.push("drawer: Tab never reached the search box");
  await page.keyboard.type("a");
  const triggerText = (await trigger.textContent())?.trim();
  if (triggerText !== "Filters (3)") fail.push(`drawer: with a search the button reads "${triggerText}", expected "Filters (3)"`);
  await page.keyboard.press("Escape");
  if ((await focus()).filter === "q") await page.keyboard.press("Escape"); // the first Escape clears the search box
  await page.waitForTimeout(600);
  const closed = await dialog.evaluate((d) => !d.open);
  const home = await focus();
  if (!closed || !home.trigger) fail.push(`drawer: Escape left it ${closed ? "closed" : "open"} with focus on ${JSON.stringify(home)}`);

  // ── 4: Clear all in the folded bar ────────────────────────────────────────
  await narrowBar.getByRole("button", { name: "Clear all" }).focus();
  await page.keyboard.press("Enter");
  const cleared = await state(NARROW);
  const f4 = await focus();
  if (cleared.chips.length !== 0 || !f4.trigger) fail.push(`folded Clear all: ${cleared.chips.length} chips left, focus ${JSON.stringify(f4)}`);

  // ── 5: right to left ──────────────────────────────────────────────────────
  const rtl = await page.evaluate(() => {
    const chip = document.querySelector('[data-sc="filters-rtl"] [data-filter-chip]');
    if (!chip) return null;
    const text = chip.querySelector("span").getBoundingClientRect();
    const button = chip.querySelector("button").getBoundingClientRect();
    return { buttonLeftOfText: button.right <= text.left + 0.5 };
  });
  if (!rtl?.buttonLeftOfText) fail.push(`rtl: the remove button is not on the chip's inline end (${JSON.stringify(rtl)})`);

  // ── 6: compact + coarse ───────────────────────────────────────────────────
  await load({ density: "compact", input: "coarse" });
  const touch = await page.evaluate(([wideSel, narrowSel]) => {
    const bar = document.querySelector(wideSel);
    bar.scrollIntoView({ block: "center" });
    const css = getComputedStyle(bar);
    const px = (name) => Number.parseFloat(css.getPropertyValue(name)) * (css.getPropertyValue(name).trim().endsWith("rem") ? Number.parseFloat(getComputedStyle(document.documentElement).fontSize) : 1);
    const hitBox = (el) => {
      const r = el.getBoundingClientRect();
      const before = getComputedStyle(el, "::before");
      if (before.content === "none" || before.position !== "absolute") return { w: r.width, h: r.height };
      const st = getComputedStyle(el);
      const left = r.left + Number.parseFloat(st.borderLeftWidth) + Number.parseFloat(before.left);
      const right = r.right - Number.parseFloat(st.borderRightWidth) - Number.parseFloat(before.right);
      const top = r.top + Number.parseFloat(st.borderTopWidth) + Number.parseFloat(before.top);
      const bottom = r.bottom - Number.parseFloat(st.borderBottomWidth) - Number.parseFloat(before.bottom);
      return { w: Math.max(r.right, right) - Math.min(r.left, left), h: Math.max(r.bottom, bottom) - Math.min(r.top, top) };
    };
    const summary = bar.querySelector("[data-filter-summary]");
    const removes = [...bar.querySelectorAll("[data-filter-chip] button")];
    const chip = bar.querySelector("[data-filter-chip]");
    const clear = [...bar.querySelectorAll("button")].find((b) => b.textContent.trim() === "Clear all");
    const narrowTrigger = document.querySelector(`${narrowSel} [data-filter-trigger]`);
    return {
      hitMin: px("--HIT-MIN"),
      controlH: px("--CONTROL-H"),
      removes: removes.length,
      small: removes.map((b) => hitBox(b)).filter((b) => b.w < 43.5 || b.h < 43.5).map((b) => `${b.w.toFixed(1)}×${b.h.toFixed(1)}`),
      missed: removes.filter((b) => {
        const r = b.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest("button") !== b;
      }).length,
      pitch: chip && summary ? chip.getBoundingClientRect().height + Number.parseFloat(getComputedStyle(summary).rowGap) : null,
      clearH: clear?.getBoundingClientRect().height ?? null,
      triggerH: narrowTrigger?.getBoundingClientRect().height ?? null,
    };
  }, [WIDE, NARROW]);
  summary.touch = touch;
  if (touch.hitMin !== 44 || touch.controlH !== 44) fail.push(`coarse compact: harness: --HIT-MIN ${touch.hitMin}px, --CONTROL-H ${touch.controlH}px, source predicts 44 and 44`);
  if (touch.removes < 3) fail.push(`coarse compact: harness: ${touch.removes} chip remove buttons in the dashboard bar, its start has 3`);
  if (touch.small.length) fail.push(`coarse compact: chip remove hit areas under 44px: ${touch.small.join(", ")}`);
  if (touch.missed) fail.push(`coarse compact: ${touch.missed} remove button(s) do not take a press at their centre`);
  if (touch.pitch === null || Math.abs(touch.pitch - touch.controlH) > 0.5) fail.push(`coarse compact: a chip line is ${touch.pitch}px, expected one --CONTROL-H (${touch.controlH}px)`);
  if (Math.abs((touch.clearH ?? 0) - touch.controlH) > 0.5 || Math.abs((touch.triggerH ?? 0) - touch.controlH) > 0.5) fail.push(`coarse compact: Clear all ${touch.clearH}px, Filters ${touch.triggerH}px, expected --CONTROL-H`);

  // ── 7: 375 ────────────────────────────────────────────────────────────────
  await load({ input: "coarse", width: 375 });
  const phone = await page.evaluate(() => {
    const section = document.getElementById("filters-filterbar");
    const bars = [...section.querySelectorAll('[role="search"]')];
    const pageWidth = document.documentElement.clientWidth;
    const spills = [];
    for (const b of bars) {
      const r = b.getBoundingClientRect();
      // Every box the bar draws (not `scrollWidth`, which also counts a coarse hit area's pseudo-element;
      // not a visually hidden 1px box, which sits a pixel outside on purpose).
      const boxes = [...b.querySelectorAll("*")].map((el) => el.getBoundingClientRect()).filter((q) => q.width > 1);
      const drawn = { left: Math.min(...boxes.map((q) => q.left)), right: Math.max(...boxes.map((q) => q.right)) };
      if (boxes.length === 0 || drawn.right > r.right + 0.5 || drawn.left < r.left - 0.5 || r.right > pageWidth + 0.5) {
        spills.push(`bar ${b.closest("[data-sc]")?.getAttribute("data-sc") ?? "?"}: draws ${drawn.left.toFixed(1)}–${drawn.right.toFixed(1)} in ${r.left.toFixed(1)}–${r.right.toFixed(1)}`);
      }
      for (const chip of b.querySelectorAll("[data-filter-chip]")) {
        const c = chip.getBoundingClientRect();
        if (c.right > r.right + 0.5 || c.left < r.left - 0.5) spills.push(`chip "${chip.textContent}" past its bar`);
      }
    }
    const longText = section.querySelector('[data-sc="filters-long"] [data-filter-chip] span');
    const dashboard = section.querySelector('[data-sc="filters-dashboard"] [role="search"]');
    const trigger = dashboard?.querySelector("[data-filter-trigger]");
    return {
      bars: bars.length,
      pageSpill: document.documentElement.scrollWidth - pageWidth,
      spills,
      truncated: longText ? longText.scrollWidth > longText.clientWidth : null,
      dashboardFolded: Boolean(trigger && trigger.getClientRects().length > 0),
    };
  });
  summary.phone = { bars: phone.bars, truncated: phone.truncated };
  if (phone.bars < 7) fail.push(`375: harness: ${phone.bars} bars in the section`);
  if (phone.pageSpill > 0) fail.push(`375: the page scrolls sideways by ${phone.pageSpill}px`);
  if (phone.spills.length) fail.push(`375: ${phone.spills.join("; ")}`);
  if (phone.truncated !== true) fail.push(`375: the long chip is not truncated (${phone.truncated})`);
  if (!phone.dashboardFolded) fail.push("375: the dashboard bar did not fold into the Filters button");
  const dashTrigger = page.locator('[data-sc="filters-dashboard"] [data-filter-trigger]');
  await dashTrigger.scrollIntoViewIfNeeded();
  await dashTrigger.click();
  const phoneDialog = page.locator('[data-sc="filters-dashboard"] dialog');
  await phoneDialog.waitFor();
  await page.waitForTimeout(500);
  const fit = await phoneDialog.evaluate((d) => {
    const r = d.getBoundingClientRect();
    const scrollers = [d, ...d.querySelectorAll("*")].filter((el) => el.scrollWidth > el.clientWidth + 0.5 && /auto|scroll/.test(getComputedStyle(el).overflowX));
    return { left: r.left, right: r.right, width: document.documentElement.clientWidth, spill: scrollers.map((el) => el.className.toString().slice(0, 60)) };
  });
  if (fit.left < -0.5 || fit.right > fit.width + 0.5) fail.push(`375: the drawer spans ${fit.left.toFixed(1)}–${fit.right.toFixed(1)}, the page ${fit.width}`);
  if (fit.spill.length) fail.push(`375: inside the drawer these scroll sideways: ${fit.spill.join(" | ")}`);
  await page.keyboard.press("Escape");

  stopErrors();
  if (errors.length) fail.push(`errors: ${errors.join(" | ")}`);
  if (fail.length) throw new Error(`filters-layout FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(summary)}`);
  return `filters-layout OK ${JSON.stringify(summary)}`;
}
