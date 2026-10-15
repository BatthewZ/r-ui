// Browser check: an anchored panel hides while its trigger is scrolled out of
// view, instead of following it to the viewport edge, and comes back with it.
//
// jsdom has no layout, so the hook's test can only fake the geometry; this is the
// real thing. A top-layer panel is `position: fixed`, so without `hide()` floating-ui
// keeps re-positioning it after the trigger and `shift()` pins it to the edge.
//
// Asserts, on the Popover demo (placement top, with an arrow):
//   1. harness: open, the panel is visible and sits above its trigger (its bottom
//      within 1px of trigger top minus the 8px offset);
//   2. the page scrolled until the trigger is above the viewport: the panel carries
//      `data-reference-hidden` and computes `visibility: hidden`, and it is still
//      open (mounted), so state and focus bookkeeping survive;
//   3. scrolled back: visible again, re-anchored to the trigger as in 1.
//   4. at 375, a panel never reaches the viewport's edges: the DateRangePicker's
//      two-month popup (wider than the viewport by design) and a Dashboard row's
//      actions menu (its trigger at the inline end) each sit at least the panel's
//      own --R-SIZE-2 inside `clientWidth` on both sides, and the promoted
//      panel's cap resolves against `100%` (the viewport without its scrollbar),
//      never a `vw` length (which counts the scrollbar). Headless Chromium runs
//      with hidden scrollbars, so `clientWidth` equals the viewport here and the
//      cap's computed value is what tells the two apart.
async (page) => {
  const base = page.url().split("#")[0];
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}#/overview/overlays-popover`);
  await page.evaluate(() => localStorage.removeItem("r-ui-showcase:view"));
  await page.reload();
  await waitForShowcase(page);
  const section = page.locator("#overlays-popover");
  const trigger = section.getByRole("button", { name: "With arrow" });
  await trigger.waitFor();
  await trigger.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -200));
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "About" });
  await panel.waitFor();
  await page.waitForTimeout(250);

  const read = () =>
    page.evaluate(() => {
      const t = [...document.querySelectorAll("#overlays-popover button")].find((b) => b.textContent.trim() === "With arrow");
      const p = document.querySelector('[role="dialog"][aria-label="About"]');
      if (!t || !p) return { mounted: Boolean(p) };
      const tr = t.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      return {
        mounted: true,
        visibility: getComputedStyle(p).visibility,
        flagged: p.hasAttribute("data-reference-hidden"),
        triggerTop: tr.top,
        triggerBottom: tr.bottom,
        gap: tr.top - pr.bottom,
      };
    });
  const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const fail = [];
  const open = await read();
  if (open.visibility !== "visible" || open.flagged) fail.push(`harness: open panel is not visible (${JSON.stringify(open)})`);
  if (Math.abs(open.gap - 8) > 1) fail.push(`harness: open panel is ${open.gap}px above its trigger, expected 8px`);

  await page.evaluate((by) => window.scrollBy(0, by), open.triggerBottom + 100);
  await settle();
  await page.waitForTimeout(100);
  const away = await read();
  if (!away.mounted) fail.push("scrolled away: the panel unmounted (it should only hide)");
  if (!(away.triggerBottom < 0)) fail.push(`scrolled away: the trigger is still in view (bottom ${away.triggerBottom})`);
  if (away.visibility !== "hidden" || !away.flagged) fail.push(`scrolled away: panel not hidden (${JSON.stringify(away)})`);

  await page.evaluate((by) => window.scrollBy(0, -by), open.triggerBottom + 100);
  await settle();
  await page.waitForTimeout(100);
  const back = await read();
  if (back.visibility !== "visible" || back.flagged) fail.push(`scrolled back: panel not visible (${JSON.stringify(back)})`);
  if (Math.abs(back.gap - 8) > 1) fail.push(`scrolled back: panel is ${back.gap}px above its trigger, expected 8px`);

  await page.keyboard.press("Escape");

  // 4. Edges at 375.
  await page.setViewportSize({ width: 375, height: 800 });
  const edges = (selector) =>
    page.evaluate((sel) => {
      const p = document.querySelector(sel);
      if (!p) return null;
      const probe = document.createElement("span");
      probe.style.cssText = "position: absolute; visibility: hidden; inline-size: var(--R-SIZE-2)";
      p.append(probe);
      const gap = probe.getBoundingClientRect().width;
      probe.remove();
      const r = p.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, gap, client: document.documentElement.clientWidth, cap: getComputedStyle(p).maxInlineSize };
    }, selector);
  const checkEdges = (what, e) => {
    if (!e) return fail.push(`${what}: no open panel found`);
    if (!(e.gap > 0)) fail.push(`harness: ${what}'s --R-SIZE-2 resolved to ${e.gap}px`);
    if (e.left < e.gap - 0.5) fail.push(`${what}: left edge ${e.left}px, inside the ${e.gap}px gap`);
    if (e.right > e.client - e.gap + 0.5) fail.push(`${what}: right edge ${e.right}px past clientWidth ${e.client} − ${e.gap}px`);
    if (!/100%/.test(e.cap) || /vw/.test(e.cap)) fail.push(`${what}: promoted cap is \`${e.cap}\`, expected one read against 100%`);
  };

  await page.goto(`${base}#/overview/dates-daterangepicker`);
  await page.reload();
  await waitForShowcase(page);
  const rangeTrigger = page.locator("#dates-daterangepicker").getByRole("button", { name: /Last 7 days/ }).first();
  await rangeTrigger.scrollIntoViewIfNeeded();
  await rangeTrigger.click();
  await page.locator(".r-dates-range-panel:popover-open").waitFor();
  await page.waitForTimeout(250);
  const range = await edges(".r-dates-range-panel:popover-open");
  checkEdges("range popup", range);
  // Harness: the popup is capped (its months want more than the viewport), so it tests the cap.
  if (range && !(range.width >= range.client - 2 * range.gap - 0.5)) fail.push(`harness: range popup ${range.width}px is not at its cap (${range.client} − 2 × ${range.gap})`);
  await page.keyboard.press("Escape");

  await page.goto(`${base}#/dashboard`);
  await page.reload();
  await waitForShowcase(page);
  const actions = page.locator("[data-dashboard-services] tbody tr").first().getByRole("button", { name: /^Actions for / });
  await actions.scrollIntoViewIfNeeded();
  await actions.click();
  await page.locator("[role=menu]:popover-open").waitFor();
  await page.waitForTimeout(250);
  const menu = await edges("[role=menu]:popover-open");
  checkEdges("row actions menu", menu);
  await page.keyboard.press("Escape");

  const result = { open, away, back, range, menu };
  if (fail.length) throw new Error(`floating-hide FAILED:\n  ${fail.join("\n  ")}\n${JSON.stringify(result)}`);
  return `floating-hide OK ${JSON.stringify(result)}`;
}
